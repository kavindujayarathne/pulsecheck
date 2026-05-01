"""status page endpoints list, drop platform

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "services",
        sa.Column("status_page_api_urls", sa.Text, nullable=True),
    )
    # Migrate existing single URL into a JSON array of one element.
    op.execute(
        """
        UPDATE services
        SET status_page_api_urls = '["' || replace(status_page_api_url, '"', '\\"') || '"]'
        WHERE status_page_api_url IS NOT NULL
        """
    )
    op.drop_column("services", "status_page_api_url")
    op.drop_column("services", "status_page_platform")


def downgrade() -> None:
    op.add_column("services", sa.Column("status_page_platform", sa.String, nullable=True))
    op.add_column("services", sa.Column("status_page_api_url", sa.String, nullable=True))
    # Take the first URL from the list back into the singular column.
    op.execute(
        """
        UPDATE services
        SET status_page_api_url = (status_page_api_urls::json ->> 0)
        WHERE status_page_api_urls IS NOT NULL
        """
    )
    op.drop_column("services", "status_page_api_urls")
