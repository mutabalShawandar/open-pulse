"""add phase 3 campaigns and public responses

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    campaign_status = postgresql.ENUM(
        "draft",
        "scheduled",
        "active",
        "paused",
        "completed",
        "cancelled",
        name="campaign_status",
        create_type=False,
    )
    identity_mode = postgresql.ENUM(
        "anonymous",
        "optional_email",
        "identified",
        name="response_identity_mode",
        create_type=False,
    )
    response_status = postgresql.ENUM(
        "in_progress", "completed", name="response_status", create_type=False
    )
    identity_snapshot = postgresql.ENUM(
        "anonymous",
        "optional_email",
        "identified",
        name="response_identity_mode_snapshot",
        create_type=False,
    )
    for enum_type in (campaign_status, identity_mode, response_status, identity_snapshot):
        enum_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "clinic_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clinics.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "survey_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("survey_versions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("public_slug", sa.String(length=128), nullable=False, unique=True),
        sa.Column("status", campaign_status, nullable=False, server_default="draft"),
        sa.Column(
            "response_identity_mode", identity_mode, nullable=False, server_default="anonymous"
        ),
        sa.Column("branding", sa.JSON(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at",
            name="ck_campaigns_valid_date_window",
        ),
    )
    op.create_index("ix_campaigns_clinic_id", "campaigns", ["clinic_id"])
    op.create_index("ix_campaigns_survey_version_id", "campaigns", ["survey_version_id"])
    op.create_index("ix_campaigns_status", "campaigns", ["status"])
    op.create_index("ix_campaigns_clinic_status", "campaigns", ["clinic_id", "status"])

    op.create_table(
        "survey_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "campaign_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("campaigns.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "survey_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("survey_versions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", response_status, nullable=False, server_default="in_progress"),
        sa.Column("identity_mode_snapshot", identity_snapshot, nullable=False),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_survey_responses_campaign_id", "survey_responses", ["campaign_id"])
    op.create_index(
        "ix_survey_responses_survey_version_id", "survey_responses", ["survey_version_id"]
    )
    op.create_index(
        "ix_survey_responses_campaign_status", "survey_responses", ["campaign_id", "status"]
    )

    op.create_table(
        "response_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "response_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("survey_responses.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_response_sessions_expires_at", "response_sessions", ["expires_at"])

    op.create_table(
        "response_answers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "response_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("survey_responses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "question_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("survey_questions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("text_value", sa.Text(), nullable=True),
        sa.Column("number_value", sa.Numeric(), nullable=True),
        sa.Column("date_value", sa.Date(), nullable=True),
        sa.Column("boolean_value", sa.Boolean(), nullable=True),
        sa.Column("other_text", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "response_id", "question_id", name="uq_response_answers_response_question"
        ),
        sa.CheckConstraint(
            "(text_value IS NOT NULL)::integer + (number_value IS NOT NULL)::integer + (date_value IS NOT NULL)::integer + (boolean_value IS NOT NULL)::integer <= 1",
            name="ck_response_answers_one_scalar_value",
        ),
    )
    op.create_index("ix_response_answers_response_id", "response_answers", ["response_id"])
    op.create_index("ix_response_answers_question_id", "response_answers", ["question_id"])
    op.create_table(
        "response_answer_options",
        sa.Column(
            "answer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("response_answers.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "option_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("survey_question_options.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
    )


def downgrade() -> None:
    op.drop_table("response_answer_options")
    op.drop_index("ix_response_answers_question_id", table_name="response_answers")
    op.drop_index("ix_response_answers_response_id", table_name="response_answers")
    op.drop_table("response_answers")
    op.drop_index("ix_response_sessions_expires_at", table_name="response_sessions")
    op.drop_table("response_sessions")
    op.drop_index("ix_survey_responses_campaign_status", table_name="survey_responses")
    op.drop_index("ix_survey_responses_survey_version_id", table_name="survey_responses")
    op.drop_index("ix_survey_responses_campaign_id", table_name="survey_responses")
    op.drop_table("survey_responses")
    op.drop_index("ix_campaigns_clinic_status", table_name="campaigns")
    op.drop_index("ix_campaigns_status", table_name="campaigns")
    op.drop_index("ix_campaigns_survey_version_id", table_name="campaigns")
    op.drop_index("ix_campaigns_clinic_id", table_name="campaigns")
    op.drop_table("campaigns")
    for enum_name in (
        "response_identity_mode_snapshot",
        "response_status",
        "response_identity_mode",
        "campaign_status",
    ):
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)
