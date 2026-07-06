from datetime import datetime, timezone

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Club(Base):
    __tablename__ = "clubs"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_api_football_id: Mapped[int | None] = mapped_column(Integer, unique=True, index=True)
    # football-data.org kimligi — Süper Lig disindaki lig kulupleri icin
    external_football_data_org_id: Mapped[int | None] = mapped_column(
        Integer, unique=True, index=True
    )
    transfermarkt_id: Mapped[int | None] = mapped_column(Integer, index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    short_name: Mapped[str | None] = mapped_column(String(40))
    logo_url: Mapped[str | None] = mapped_column(String(300))
    league: Mapped[str | None] = mapped_column(String(80), index=True)
    country: Mapped[str | None] = mapped_column(String(60), index=True)

    coach: Mapped["Coach | None"] = relationship(back_populates="club", uselist=False)
    players: Mapped[list["Player"]] = relationship(back_populates="club")


class Coach(Base):
    __tablename__ = "coaches"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[int | None] = mapped_column(Integer, index=True)
    name: Mapped[str] = mapped_column(String(120))
    photo_url: Mapped[str | None] = mapped_column(String(300))
    nationality: Mapped[str | None] = mapped_column(String(60))
    club_id: Mapped[int | None] = mapped_column(ForeignKey("clubs.id"), index=True)

    club: Mapped[Club | None] = relationship(back_populates="coach")


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_api_football_id: Mapped[int | None] = mapped_column(Integer, unique=True, index=True)
    # football-data.org kimligi — Süper Lig disindaki lig oyunculari icin
    external_football_data_org_id: Mapped[int | None] = mapped_column(
        Integer, unique=True, index=True
    )
    transfermarkt_id: Mapped[int | None] = mapped_column(Integer, index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    photo_url: Mapped[str | None] = mapped_column(String(300))
    # Ana kategori: GK / DF / MF / FW
    position: Mapped[str] = mapped_column(String(4), index=True)
    # Detay pozisyon (orn. "Stoper", "Sol Kanat")
    detail_position: Mapped[str | None] = mapped_column(String(40))
    club_id: Mapped[int | None] = mapped_column(ForeignKey("clubs.id"), index=True)
    nationality: Mapped[str | None] = mapped_column(String(60))
    age: Mapped[int | None] = mapped_column(Integer)
    jersey_number: Mapped[int | None] = mapped_column(Integer)
    # EUR cinsinden piyasa degeri (transfermarkt-api'den senkronize edilir)
    market_value: Mapped[int | None] = mapped_column(BigInteger)
    market_value_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    club: Mapped[Club | None] = relationship(back_populates="players")


class Formation(Base):
    __tablename__ = "formations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(20), unique=True)
    # [{"key": "GK", "label": "Kaleci", "role": "GK", "x": 50, "y": 88}, ...]
    position_slots: Mapped[list] = mapped_column(JSON)


class Lineup(Base):
    __tablename__ = "lineups"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Misafir kullanim: auth yok, istemci lineup id'sini kendisi saklar
    user_id: Mapped[str | None] = mapped_column(String(64), index=True)
    club_id: Mapped[int] = mapped_column(ForeignKey("clubs.id"), index=True)
    formation_id: Mapped[int] = mapped_column(ForeignKey("formations.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    club: Mapped[Club] = relationship()
    formation: Mapped[Formation] = relationship()
    slots: Mapped[list["LineupSlot"]] = relationship(
        back_populates="lineup", cascade="all, delete-orphan"
    )


class LineupSlot(Base):
    __tablename__ = "lineup_slots"
    __table_args__ = (UniqueConstraint("lineup_id", "position_key", name="uq_lineup_position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    lineup_id: Mapped[int] = mapped_column(ForeignKey("lineups.id"), index=True)
    # Formation.position_slots icindeki "key" ile eslesir
    position_key: Mapped[str] = mapped_column(String(12))
    player_id: Mapped[int | None] = mapped_column(ForeignKey("players.id"))

    lineup: Mapped[Lineup] = relationship(back_populates="slots")
    player: Mapped[Player | None] = relationship()


class PlayerSeasonStat(Base):
    """Gol/asist krallığı verisi — iki kaynaktan gelebilir:

    - "api_football": ulusal ligler + UEFA kupaları, ama ücretsiz planda en
      yeni sezon 2024 (2024-25) ile sınırlı.
    - "football_data_org": PL/La Liga/Bundesliga/Serie A/Ligue 1/Şampiyonlar
      Ligi için GÜNCEL sezon (2025-26), ama yalnızca gol verisi var (asist yok).

    Denormalize edilmiş (isim, foto, kulüp) — lider tablosu joinsiz döner.
    `league_id` iki kaynağın kendi ID uzayını kullanır; çakışmayı önlemek için
    unique constraint'e `source` da dahil edilir.
    """

    __tablename__ = "player_season_stats"
    __table_args__ = (
        UniqueConstraint(
            "external_player_id", "league_id", "season", "source", name="uq_player_season"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(20), default="api_football", index=True)
    external_player_id: Mapped[int] = mapped_column(Integer, index=True)
    player_id: Mapped[int | None] = mapped_column(ForeignKey("players.id"))
    name: Mapped[str] = mapped_column(String(120))
    photo_url: Mapped[str | None] = mapped_column(String(300))
    club_name: Mapped[str | None] = mapped_column(String(120))
    club_logo: Mapped[str | None] = mapped_column(String(300))
    league_id: Mapped[int] = mapped_column(Integer, index=True)
    league_name: Mapped[str | None] = mapped_column(String(80))
    season: Mapped[int] = mapped_column(Integer)
    goals: Mapped[int] = mapped_column(Integer, default=0)
    assists: Mapped[int] = mapped_column(Integer, default=0)
    yellow_cards: Mapped[int] = mapped_column(Integer, default=0)
    red_cards: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Transfer(Base):
    """API-Football /transfers verisi (şimdilik saklanır, UI ileride)."""

    __tablename__ = "transfers"
    __table_args__ = (
        UniqueConstraint(
            "external_player_id", "transfer_date", "to_club", name="uq_transfer"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    external_player_id: Mapped[int] = mapped_column(Integer, index=True)
    player_id: Mapped[int | None] = mapped_column(ForeignKey("players.id"))
    player_name: Mapped[str] = mapped_column(String(120))
    from_club: Mapped[str | None] = mapped_column(String(120))
    to_club: Mapped[str | None] = mapped_column(String(120))
    transfer_date: Mapped[str | None] = mapped_column(String(20), index=True)
    fee: Mapped[str | None] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
