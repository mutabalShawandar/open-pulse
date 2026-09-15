"""add agency survey catalogue

Revision ID: c2a8e4f1d9b7
Revises: 7a3c9d1e2b4f
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "c2a8e4f1d9b7"
down_revision = "7a3c9d1e2b4f"
branch_labels = None
depends_on = None


survey_status = postgresql.ENUM(
    "draft", "published", "archived", name="survey_status", create_type=False
)
survey_version_status = postgresql.ENUM(
    "draft", "published", name="survey_version_status", create_type=False
)
survey_question_type = postgresql.ENUM(
    "single_choice",
    "multiple_choice",
    "yes_no",
    "rating",
    "short_text",
    "long_text",
    "number",
    "date",
    name="survey_question_type",
    create_type=False,
)

SURVEY_READ_PERMISSION_ID = "10000000-0000-0000-0000-00000000000e"
SURVEY_ASSIGN_PERMISSION_ID = "10000000-0000-0000-0000-00000000000f"
PLATFORM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"


def upgrade() -> None:
    bind = op.get_bind()
    survey_status.create(bind, checkfirst=True)
    survey_version_status.create(bind, checkfirst=True)
    survey_question_type.create(bind, checkfirst=True)

    op.create_table(
        "surveys",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", survey_status, server_default="draft", nullable=False),
        sa.Column("created_by_user_id", sa.UUID(), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_surveys_status", "surveys", ["status"])

    op.create_table(
        "survey_versions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("survey_id", sa.UUID(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=True),
        sa.Column("status", survey_version_status, server_default="draft", nullable=False),
        sa.Column("draft_label", sa.String(length=255), nullable=True),
        sa.Column("based_on_version_id", sa.UUID(), nullable=True),
        sa.Column("created_by_user_id", sa.UUID(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "(status = 'draft' AND version_number IS NULL AND published_at IS NULL) "
            "OR (status = 'published' AND version_number IS NOT NULL AND published_at IS NOT NULL)",
            name="ck_survey_versions_publication_state",
        ),
        sa.CheckConstraint(
            "version_number IS NULL OR version_number > 0",
            name="ck_survey_versions_positive_version_number",
        ),
        sa.ForeignKeyConstraint(["based_on_version_id"], ["survey_versions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["survey_id"], ["surveys.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_survey_versions_survey_id", "survey_versions", ["survey_id"])
    op.create_index("ix_survey_versions_status", "survey_versions", ["status"])
    op.create_index("ix_survey_versions_based_on_version_id", "survey_versions", ["based_on_version_id"])
    op.create_index(
        "uq_survey_versions_published_number",
        "survey_versions",
        ["survey_id", "version_number"],
        unique=True,
        postgresql_where=sa.text("version_number IS NOT NULL"),
    )

    op.create_table(
        "survey_version_clinics",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("survey_version_id", sa.UUID(), nullable=False),
        sa.Column("clinic_id", sa.UUID(), nullable=False),
        sa.Column("assigned_by_user_id", sa.UUID(), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("unassigned_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["assigned_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["survey_version_id"], ["survey_versions.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_survey_version_clinics_survey_version_id", "survey_version_clinics", ["survey_version_id"])
    op.create_index("ix_survey_version_clinics_clinic_id", "survey_version_clinics", ["clinic_id"])
    op.create_index(
        "uq_survey_version_clinics_active_assignment",
        "survey_version_clinics",
        ["survey_version_id", "clinic_id"],
        unique=True,
        postgresql_where=sa.text("unassigned_at IS NULL"),
    )

    op.create_table(
        "survey_sections",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("survey_version_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("position >= 0", name="ck_survey_sections_position_nonnegative"),
        sa.ForeignKeyConstraint(["survey_version_id"], ["survey_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("survey_version_id", "position", name="uq_survey_sections_version_position"),
    )
    op.create_index("ix_survey_sections_survey_version_id", "survey_sections", ["survey_version_id"])

    op.create_table(
        "survey_questions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("section_id", sa.UUID(), nullable=False),
        sa.Column("question_type", survey_question_type, nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("help_text", sa.Text(), nullable=True),
        sa.Column("is_required", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("position >= 0", name="ck_survey_questions_position_nonnegative"),
        sa.ForeignKeyConstraint(["section_id"], ["survey_sections.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("section_id", "position", name="uq_survey_questions_section_position"),
    )
    op.create_index("ix_survey_questions_section_id", "survey_questions", ["section_id"])

    op.create_table(
        "survey_question_options",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.Column("label", sa.String(length=500), nullable=False),
        sa.Column("value", sa.String(length=255), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("position >= 0", name="ck_survey_question_options_position_nonnegative"),
        sa.ForeignKeyConstraint(["question_id"], ["survey_questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("question_id", "position", name="uq_survey_question_options_position"),
        sa.UniqueConstraint("question_id", "value", name="uq_survey_question_options_value"),
    )
    op.create_index("ix_survey_question_options_question_id", "survey_question_options", ["question_id"])

    op.create_table(
        "survey_question_validations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.Column("rule_type", sa.String(length=100), nullable=False),
        sa.Column("rule_value", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["question_id"], ["survey_questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("question_id", "rule_type", name="uq_survey_question_validations_rule_type"),
    )
    op.create_index("ix_survey_question_validations_question_id", "survey_question_validations", ["question_id"])

    permissions = sa.table(
        "permissions",
        sa.column("id", sa.UUID()),
        sa.column("name", sa.String()),
        sa.column("description", sa.String()),
    )
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role_id", sa.UUID()),
        sa.column("permission_id", sa.UUID()),
    )
    op.bulk_insert(
        permissions,
        [
            {
                "id": SURVEY_READ_PERMISSION_ID,
                "name": "survey.read",
                "description": "Allows reading the agency survey catalogue.",
            },
            {
                "id": SURVEY_ASSIGN_PERMISSION_ID,
                "name": "survey.assign",
                "description": "Allows assigning published survey versions to clinics.",
            },
        ],
    )
    op.bulk_insert(
        role_permissions,
        [
            {"role_id": PLATFORM_ADMIN_ROLE_ID, "permission_id": SURVEY_READ_PERMISSION_ID},
            {"role_id": PLATFORM_ADMIN_ROLE_ID, "permission_id": SURVEY_ASSIGN_PERMISSION_ID},
        ],
    )


def downgrade() -> None:
    connection = op.get_bind()
    permission_ids = [SURVEY_READ_PERMISSION_ID, SURVEY_ASSIGN_PERMISSION_ID]
    connection.execute(
        sa.text("DELETE FROM role_permissions WHERE permission_id IN :permission_ids").bindparams(
            sa.bindparam("permission_ids", expanding=True)
        ),
        {"permission_ids": permission_ids},
    )
    connection.execute(
        sa.text("DELETE FROM permissions WHERE id IN :permission_ids").bindparams(
            sa.bindparam("permission_ids", expanding=True)
        ),
        {"permission_ids": permission_ids},
    )

    op.drop_index("ix_survey_question_validations_question_id", table_name="survey_question_validations")
    op.drop_table("survey_question_validations")
    op.drop_index("ix_survey_question_options_question_id", table_name="survey_question_options")
    op.drop_table("survey_question_options")
    op.drop_index("ix_survey_questions_section_id", table_name="survey_questions")
    op.drop_table("survey_questions")
    op.drop_index("ix_survey_sections_survey_version_id", table_name="survey_sections")
    op.drop_table("survey_sections")
    op.drop_index("uq_survey_version_clinics_active_assignment", table_name="survey_version_clinics")
    op.drop_index("ix_survey_version_clinics_clinic_id", table_name="survey_version_clinics")
    op.drop_index("ix_survey_version_clinics_survey_version_id", table_name="survey_version_clinics")
    op.drop_table("survey_version_clinics")
    op.drop_index("uq_survey_versions_published_number", table_name="survey_versions")
    op.drop_index("ix_survey_versions_based_on_version_id", table_name="survey_versions")
    op.drop_index("ix_survey_versions_status", table_name="survey_versions")
    op.drop_index("ix_survey_versions_survey_id", table_name="survey_versions")
    op.drop_table("survey_versions")
    op.drop_index("ix_surveys_status", table_name="surveys")
    op.drop_table("surveys")

    bind = op.get_bind()
    survey_question_type.drop(bind, checkfirst=True)
    survey_version_status.drop(bind, checkfirst=True)
    survey_status.drop(bind, checkfirst=True)
