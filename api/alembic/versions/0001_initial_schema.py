"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String, unique=True, nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("auth_provider", sa.String, nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "services",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("url", sa.String, nullable=False),
        sa.Column("category", sa.String),
        sa.Column("check_interval", sa.Integer, nullable=False, server_default="30"),
        sa.Column("status_page_url", sa.String),
        sa.Column("expected_status", sa.Integer, nullable=False, server_default="200"),
        sa.Column("timeout_ms", sa.Integer, nullable=False, server_default="5000"),
        sa.Column("degraded_threshold_ms", sa.Integer, nullable=False, server_default="1000"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "checks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("service_id", UUID(as_uuid=True), sa.ForeignKey("services.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status_code", sa.Integer),
        sa.Column("response_time", sa.Integer),
        sa.Column("status", sa.String, nullable=False),
        sa.Column("checked_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "incidents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("service_id", UUID(as_uuid=True), sa.ForeignKey("services.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String, nullable=False),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("checks_failed", sa.Integer, nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("incidents")
    op.drop_table("checks")
    op.drop_table("services")
    op.drop_table("users")
