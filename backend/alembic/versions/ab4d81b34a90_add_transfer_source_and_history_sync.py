"""add transfer source and history sync

Revision ID: ab4d81b34a90
Revises: 6b9f7a2e4c31
Create Date: 2026-07-07 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ab4d81b34a90"
down_revision: Union[str, Sequence[str], None] = "6b9f7a2e4c31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    player_columns = {column["name"] for column in inspector.get_columns("players")}
    if "transfer_history_synced_at" not in player_columns:
        op.add_column(
            "players",
            sa.Column("transfer_history_synced_at", sa.DateTime(timezone=True), nullable=True),
        )

    transfer_columns = {column["name"] for column in inspector.get_columns("transfers")}
    if "source" not in transfer_columns:
        op.add_column(
            "transfers",
            sa.Column("source", sa.String(length=20), nullable=False, server_default="api_football"),
        )
        op.alter_column("transfers", "source", server_default=None)
    if "external_transfer_id" not in transfer_columns:
        op.add_column("transfers", sa.Column("external_transfer_id", sa.String(length=40), nullable=True))
    if "external_from_club_id" not in transfer_columns:
        op.add_column("transfers", sa.Column("external_from_club_id", sa.String(length=40), nullable=True))
    if "external_to_club_id" not in transfer_columns:
        op.add_column("transfers", sa.Column("external_to_club_id", sa.String(length=40), nullable=True))

    indexes = {index["name"] for index in inspector.get_indexes("transfers")}
    for name, columns in {
        op.f("ix_transfers_source"): ["source"],
        op.f("ix_transfers_external_transfer_id"): ["external_transfer_id"],
        op.f("ix_transfers_external_from_club_id"): ["external_from_club_id"],
        op.f("ix_transfers_external_to_club_id"): ["external_to_club_id"],
    }.items():
        if name not in indexes:
            op.create_index(name, "transfers", columns, unique=False)

    uniques = {constraint["name"] for constraint in inspector.get_unique_constraints("transfers")}
    if "uq_transfer" in uniques:
        op.drop_constraint("uq_transfer", "transfers", type_="unique")
    op.create_unique_constraint(
        "uq_transfer",
        "transfers",
        ["source", "external_player_id", "transfer_date", "to_club"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_transfer", "transfers", type_="unique")
    op.create_unique_constraint("uq_transfer", "transfers", ["external_player_id", "transfer_date", "to_club"])
    op.drop_index(op.f("ix_transfers_external_to_club_id"), table_name="transfers")
    op.drop_index(op.f("ix_transfers_external_from_club_id"), table_name="transfers")
    op.drop_index(op.f("ix_transfers_external_transfer_id"), table_name="transfers")
    op.drop_index(op.f("ix_transfers_source"), table_name="transfers")
    op.drop_column("transfers", "external_to_club_id")
    op.drop_column("transfers", "external_from_club_id")
    op.drop_column("transfers", "external_transfer_id")
    op.drop_column("transfers", "source")
    op.drop_column("players", "transfer_history_synced_at")
