"""add trophies

Revision ID: 6b9f7a2e4c31
Revises: 295383570944
Create Date: 2026-07-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6b9f7a2e4c31"
down_revision: Union[str, Sequence[str], None] = "295383570944"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    coach_columns = {column["name"] for column in inspector.get_columns("coaches")}
    if "trophies_synced_at" not in coach_columns:
        op.add_column("coaches", sa.Column("trophies_synced_at", sa.DateTime(timezone=True), nullable=True))

    player_columns = {column["name"] for column in inspector.get_columns("players")}
    if "trophies_synced_at" not in player_columns:
        op.add_column("players", sa.Column("trophies_synced_at", sa.DateTime(timezone=True), nullable=True))

    if "trophies" not in tables:
        op.create_table(
            "trophies",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("holder_type", sa.String(length=12), nullable=False),
            sa.Column("holder_id", sa.Integer(), nullable=False),
            sa.Column("external_holder_id", sa.Integer(), nullable=True),
            sa.Column("competition_name", sa.String(length=160), nullable=False),
            sa.Column("season", sa.String(length=20), nullable=True),
            sa.Column("place", sa.String(length=40), nullable=True),
            sa.Column("club_name", sa.String(length=120), nullable=True),
            sa.Column("country", sa.String(length=80), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "holder_type",
                "holder_id",
                "competition_name",
                "season",
                "place",
                "club_name",
                name="uq_trophy_holder_competition",
            ),
        )

    indexes = {index["name"] for index in inspector.get_indexes("trophies")}
    for name, columns in {
        op.f("ix_trophies_competition_name"): ["competition_name"],
        op.f("ix_trophies_external_holder_id"): ["external_holder_id"],
        op.f("ix_trophies_holder_id"): ["holder_id"],
        op.f("ix_trophies_holder_type"): ["holder_type"],
        op.f("ix_trophies_place"): ["place"],
        op.f("ix_trophies_season"): ["season"],
    }.items():
        if name not in indexes:
            op.create_index(name, "trophies", columns, unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_trophies_season"), table_name="trophies")
    op.drop_index(op.f("ix_trophies_place"), table_name="trophies")
    op.drop_index(op.f("ix_trophies_holder_type"), table_name="trophies")
    op.drop_index(op.f("ix_trophies_holder_id"), table_name="trophies")
    op.drop_index(op.f("ix_trophies_external_holder_id"), table_name="trophies")
    op.drop_index(op.f("ix_trophies_competition_name"), table_name="trophies")
    op.drop_table("trophies")
    op.drop_column("players", "trophies_synced_at")
    op.drop_column("coaches", "trophies_synced_at")
