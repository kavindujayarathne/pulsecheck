"""status page monitoring

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "services",
        sa.Column("monitor_type", sa.String, nullable=False, server_default="http_ping"),
    )
    op.add_column("services", sa.Column("status_page_api_url", sa.String, nullable=True))
    op.add_column("services", sa.Column("status_page_platform", sa.String, nullable=True))
    op.add_column("services", sa.Column("component_name", sa.String, nullable=True))
    op.alter_column("services", "url", existing_type=sa.String, nullable=True)


def downgrade() -> None:
    op.alter_column("services", "url", existing_type=sa.String, nullable=False)
    op.drop_column("services", "component_name")
    op.drop_column("services", "status_page_platform")
    op.drop_column("services", "status_page_api_url")
    op.drop_column("services", "monitor_type")
