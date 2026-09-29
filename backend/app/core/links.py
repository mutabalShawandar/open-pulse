import re
import unicodedata

from app.core.config import settings


def normalize_campaign_path(campaign_title: str) -> str:
    """Create the readable, stable path stored for a campaign."""
    normalized = unicodedata.normalize("NFKD", campaign_title.replace("ß", "ss")).encode("ascii", "ignore").decode("ascii").lower()
    readable = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")[:80]
    return readable or "survey"


def build_public_survey_url(workspace_slug: str, public_path: str, token: str | None = None) -> str:
    """Build the recipient-facing survey URL.

    Uses "{workspace_slug}.{public_root_domain}/{public_path}" when PUBLIC_ROOT_DOMAIN is
    configured (requires wildcard DNS/TLS and the frontend's subdomain-rewrite middleware),
    otherwise falls back to "{public_frontend_url}/respond/{public_slug}".
    """
    query = f"?token={token}" if token else ""
    if settings.public_root_domain:
        return f"https://{workspace_slug}.{settings.public_root_domain}/{public_path}{query}"
    return f"{settings.public_frontend_url.rstrip('/')}/respond/{public_path}{query}"
