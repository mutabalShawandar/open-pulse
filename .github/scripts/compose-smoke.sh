#!/usr/bin/env bash
# End-to-end smoke test of the one-command local setup.
#
# Starts the full Compose stack with the demo profile, then verifies that the seeded
# admin, default SMTP settings and demo data exist, that the services answer, and that
# a campaign can actually be sent and arrives in Mailpit.
#
# CI runs it as-is. To run it locally against a throwaway copy of the stack, set e.g.
#   COMPOSE="docker compose -p smoke" ./.github/scripts/compose-smoke.sh
set -euo pipefail

COMPOSE="${COMPOSE:-docker compose}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-600}"

dump_logs() {
  echo "::group::Compose state and logs"
  $COMPOSE --profile demo ps -a || true
  $COMPOSE --profile demo logs --no-color --tail=80 || true
  echo "::endgroup::"
}
trap 'status=$?; if [ "$status" -ne 0 ]; then dump_logs; fi' EXIT

psql_value() {
  $COMPOSE exec -T postgres sh -c \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"' _ "$1"
}

check() { # check <description> <expected> <actual>
  if [ "$2" != "$3" ]; then
    echo "FAIL: $1 (expected '$2', got '$3')" >&2
    exit 1
  fi
  echo "ok: $1"
}

wait_for_exit_zero() { # wait_for_exit_zero <service>
  local deadline=$((SECONDS + TIMEOUT_SECONDS)) cid state code
  while [ "$SECONDS" -lt "$deadline" ]; do
    cid="$($COMPOSE --profile demo ps -a -q "$1" || true)"
    if [ -n "$cid" ]; then
      state="$(docker inspect -f '{{.State.Status}}' "$cid")"
      code="$(docker inspect -f '{{.State.ExitCode}}' "$cid")"
      if [ "$state" = "exited" ]; then
        [ "$code" = "0" ] && { echo "ok: $1 finished"; return 0; }
        echo "FAIL: $1 exited with code $code" >&2
        return 1
      fi
    fi
    sleep 3
  done
  echo "FAIL: $1 did not finish within ${TIMEOUT_SECONDS}s" >&2
  return 1
}

wait_for_http() { # wait_for_http <url>
  local deadline=$((SECONDS + TIMEOUT_SECONDS))
  until curl -fsS -o /dev/null "$1"; do
    [ "$SECONDS" -lt "$deadline" ] || { echo "FAIL: $1 not reachable" >&2; return 1; }
    sleep 3
  done
  echo "ok: $1 reachable"
}

$COMPOSE --profile demo up -d --build

wait_for_exit_zero migrate
wait_for_exit_zero bootstrap-admin
wait_for_exit_zero seed-demo

wait_for_http http://localhost:8000/ready
wait_for_http http://localhost:8081/realms/openpulse
wait_for_http http://localhost:3000/login
wait_for_http http://localhost:8025/api/v1/info

check "seeded admin exists" 1 "$(psql_value "select count(*) from users where email = 'admin@openpulse.local'")"
check "default SMTP points at Mailpit" mailpit:1025 "$(psql_value "select host || ':' || port from smtp_configurations limit 1")"
check "demo survey seeded" 1 "$(psql_value "select count(*) from surveys")"
check "demo responses seeded" 6 "$(psql_value "select count(*) from survey_responses")"
check "demo invitations pending" 3 "$(psql_value "select count(*) from campaign_recipients where status = 'pending'")"

# Send the unsent demo campaign through the same service the API's send action uses.
$COMPOSE exec -T backend python - <<'PY'
import asyncio

from sqlalchemy import select

from app.db.session import async_session_factory
from app.models import Campaign, User
from app.services.delivery_service import queue_campaign_deliveries


async def main() -> None:
    async with async_session_factory() as session:
        campaign = await session.scalar(
            select(Campaign).where(Campaign.public_slug == "demo-invitations")
        )
        admin = await session.scalar(select(User).where(User.email == "admin@openpulse.local"))
        print(await queue_campaign_deliveries(session, campaign.id, admin.id))


asyncio.run(main())
PY

deadline=$((SECONDS + 120))
until [ "$(psql_value "select count(*) from campaign_deliveries where status = 'sent'")" = "3" ]; do
  [ "$SECONDS" -lt "$deadline" ] || { echo "FAIL: deliveries were not sent" >&2; exit 1; }
  sleep 3
done
echo "ok: 3 deliveries sent"

check "emails arrived in Mailpit" 3 "$(curl -fsS http://localhost:8025/api/v1/messages | python3 -c 'import json,sys; print(json.load(sys.stdin)["total"])')"
echo "Compose smoke test passed."
