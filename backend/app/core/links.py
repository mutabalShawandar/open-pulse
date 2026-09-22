from app.core.config import settings


def build_public_survey_url(clinic_slug: str, public_slug: str, token: str | None = None) -> str:
    """Build the recipient-facing survey URL.

    Uses "{clinic_slug}.{public_root_domain}/{public_slug}" when PUBLIC_ROOT_DOMAIN is
    configured (requires wildcard DNS/TLS and the frontend's subdomain-rewrite middleware),
    otherwise falls back to "{public_frontend_url}/umfragen/{public_slug}".
    """
    query = f"?token={token}" if token else ""
    if settings.public_root_domain:
        return f"https://{clinic_slug}.{settings.public_root_domain}/{public_slug}{query}"
    return f"{settings.public_frontend_url.rstrip('/')}/umfragen/{public_slug}{query}"
