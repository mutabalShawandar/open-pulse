import unittest
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select

from app.models import (
    AuditEvent,
    CampaignRecipientStatus,
    CampaignStatus,
    Recipient,
    RecipientStatus,
)
from app.schemas.recipient import RecipientCreateRequest
from app.services.recipient_service import (
    assign_campaign_recipients,
    import_recipients,
    list_campaign_recipients,
    list_recipients,
    opt_out_recipient,
)
from tests.integration.db import requires_database, rolled_back_session
from tests.integration.factories import (
    make_campaign,
    make_published_survey,
    make_user,
    make_workspace,
)


def payload(email: str, name: str | None = None) -> RecipientCreateRequest:
    return RecipientCreateRequest(email=email, display_name=name)


@requires_database
class ImportRecipientsTests(unittest.IsolatedAsyncioTestCase):
    async def test_new_recipients_are_created_and_listed_in_email_order(self) -> None:
        async with rolled_back_session() as session:
            _, workspace = await make_workspace(session)
            actor = await make_user(session)
            created, duplicates = await import_recipients(
                session,
                workspace.id,
                [payload("zoe@example.test", "Zoe"), payload("amy@example.test")],
                actor.id,
            )
            self.assertEqual((len(created), duplicates), (2, 0))
            listed = await list_recipients(session, workspace.id)
            self.assertEqual(
                [recipient.email_normalized for recipient in listed],
                ["amy@example.test", "zoe@example.test"],
            )
            self.assertTrue(all(r.status == RecipientStatus.ACTIVE for r in listed))

    async def test_duplicates_within_one_import_are_collapsed(self) -> None:
        async with rolled_back_session() as session:
            _, workspace = await make_workspace(session)
            actor = await make_user(session)
            created, duplicates = await import_recipients(
                session,
                workspace.id,
                [payload("a@example.test"), payload("A@Example.test"), payload("a@example.test")],
                actor.id,
            )
            self.assertEqual(len(created), 1)
            self.assertEqual(duplicates, 2)

    async def test_recipients_that_already_exist_are_skipped(self) -> None:
        async with rolled_back_session() as session:
            _, workspace = await make_workspace(session)
            actor = await make_user(session)
            await import_recipients(session, workspace.id, [payload("a@example.test")], actor.id)
            created, duplicates = await import_recipients(
                session,
                workspace.id,
                [payload("a@example.test"), payload("b@example.test")],
                actor.id,
            )
            self.assertEqual([r.email_normalized for r in created], ["b@example.test"])
            self.assertEqual(duplicates, 1)

    async def test_the_same_address_can_exist_in_two_workspaces(self) -> None:
        async with rolled_back_session() as session:
            _, first = await make_workspace(session)
            _, second = await make_workspace(session)
            actor = await make_user(session)
            await import_recipients(session, first.id, [payload("a@example.test")], actor.id)
            created, duplicates = await import_recipients(
                session, second.id, [payload("a@example.test")], actor.id
            )
            self.assertEqual((len(created), duplicates), (1, 0))

    async def test_unknown_workspace_returns_404(self) -> None:
        async with rolled_back_session() as session:
            actor = await make_user(session)
            with self.assertRaises(HTTPException) as context:
                await import_recipients(session, uuid4(), [payload("a@example.test")], actor.id)
            self.assertEqual(context.exception.status_code, 404)

    async def test_import_is_audited_with_counts_only(self) -> None:
        async with rolled_back_session() as session:
            _, workspace = await make_workspace(session)
            actor = await make_user(session)
            await import_recipients(
                session,
                workspace.id,
                [payload("a@example.test"), payload("a@example.test")],
                actor.id,
            )
            event = await session.scalar(
                select(AuditEvent).where(
                    AuditEvent.workspace_id == workspace.id,
                    AuditEvent.action == "recipient.imported",
                )
            )
            self.assertIsNotNone(event)
            self.assertEqual(event.event_metadata, {"created_count": 1, "duplicate_count": 1})


@requires_database
class OptOutTests(unittest.IsolatedAsyncioTestCase):
    async def test_opting_out_marks_the_recipient_and_records_the_time(self) -> None:
        async with rolled_back_session() as session:
            _, workspace = await make_workspace(session)
            actor = await make_user(session)
            (recipient,), _ = await import_recipients(
                session, workspace.id, [payload("a@example.test")], actor.id
            )
            result = await opt_out_recipient(session, workspace.id, recipient.id, actor.id)
            self.assertEqual(result.status, RecipientStatus.OPTED_OUT)
            self.assertIsNotNone(result.opted_out_at)

    async def test_a_recipient_of_another_workspace_cannot_be_opted_out(self) -> None:
        async with rolled_back_session() as session:
            _, workspace = await make_workspace(session)
            _, other = await make_workspace(session)
            actor = await make_user(session)
            (recipient,), _ = await import_recipients(
                session, workspace.id, [payload("a@example.test")], actor.id
            )
            with self.assertRaises(HTTPException) as context:
                await opt_out_recipient(session, other.id, recipient.id, actor.id)
            self.assertEqual(context.exception.status_code, 404)
            await session.refresh(recipient)
            self.assertEqual(recipient.status, RecipientStatus.ACTIVE)


@requires_database
class AssignCampaignRecipientsTests(unittest.IsolatedAsyncioTestCase):
    async def _setup(self, session, status: CampaignStatus = CampaignStatus.DRAFT):
        fixture = await make_published_survey(session)
        campaign = await make_campaign(session, fixture, status)
        actor = await make_user(session)
        recipients, _ = await import_recipients(
            session,
            fixture.workspace.id,
            [payload("a@example.test"), payload("b@example.test")],
            actor.id,
        )
        return fixture, campaign, actor, recipients

    async def test_selected_recipients_are_attached_as_pending_with_distinct_hashed_tokens(
        self,
    ) -> None:
        async with rolled_back_session() as session:
            _, campaign, actor, recipients = await self._setup(session)
            rows = await assign_campaign_recipients(
                session, campaign.id, [r.id for r in recipients], actor.id
            )
            self.assertEqual(len(rows), 2)
            self.assertTrue(all(row.status == CampaignRecipientStatus.PENDING for row, _ in rows))
            hashes = {row.token_hash for row, _ in rows}
            self.assertEqual(len(hashes), 2)
            self.assertTrue(all(len(value) == 64 for value in hashes))

    async def test_duplicate_ids_and_repeat_assignment_do_not_create_duplicates(self) -> None:
        async with rolled_back_session() as session:
            _, campaign, actor, recipients = await self._setup(session)
            ids = [recipients[0].id, recipients[0].id]
            await assign_campaign_recipients(session, campaign.id, ids, actor.id)
            await assign_campaign_recipients(session, campaign.id, ids, actor.id)
            rows = await list_campaign_recipients(session, campaign.id)
            self.assertEqual(len(rows), 1)

    async def test_recipients_of_another_workspace_are_rejected(self) -> None:
        async with rolled_back_session() as session:
            _, campaign, actor, _ = await self._setup(session)
            _, other = await make_workspace(session)
            (foreign,), _ = await import_recipients(
                session, other.id, [payload("x@example.test")], actor.id
            )
            with self.assertRaises(HTTPException) as context:
                await assign_campaign_recipients(session, campaign.id, [foreign.id], actor.id)
            self.assertEqual(context.exception.status_code, 422)

    async def test_unknown_recipient_ids_are_rejected(self) -> None:
        async with rolled_back_session() as session:
            _, campaign, actor, _ = await self._setup(session)
            with self.assertRaises(HTTPException) as context:
                await assign_campaign_recipients(session, campaign.id, [uuid4()], actor.id)
            self.assertEqual(context.exception.status_code, 422)

    async def test_recipients_cannot_change_once_the_campaign_is_active(self) -> None:
        async with rolled_back_session() as session:
            _, campaign, actor, recipients = await self._setup(session, CampaignStatus.ACTIVE)
            with self.assertRaises(HTTPException) as context:
                await assign_campaign_recipients(session, campaign.id, [recipients[0].id], actor.id)
            self.assertEqual(context.exception.status_code, 409)

    async def test_unknown_campaign_returns_404(self) -> None:
        async with rolled_back_session() as session:
            actor = await make_user(session)
            with self.assertRaises(HTTPException) as context:
                await assign_campaign_recipients(session, uuid4(), [uuid4()], actor.id)
            self.assertEqual(context.exception.status_code, 404)
            with self.assertRaises(HTTPException) as context:
                await list_campaign_recipients(session, uuid4())
            self.assertEqual(context.exception.status_code, 404)

    async def test_opted_out_recipients_are_not_attached(self) -> None:
        async with rolled_back_session() as session:
            fixture, campaign, actor, recipients = await self._setup(session)
            await opt_out_recipient(session, fixture.workspace.id, recipients[0].id, actor.id)
            rows = await assign_campaign_recipients(
                session, campaign.id, [r.id for r in recipients], actor.id
            )
            attached = {recipient.id for _, recipient in rows}
            self.assertNotIn(recipients[0].id, attached)
            self.assertIn(recipients[1].id, attached)
            self.assertEqual(
                await session.scalar(
                    select(Recipient.status).where(Recipient.id == recipients[0].id)
                ),
                RecipientStatus.OPTED_OUT,
            )


if __name__ == "__main__":
    unittest.main()
