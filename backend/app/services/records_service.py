import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Club, Player, PlayerSeasonStat

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "football_records.json"

GROUP_LABELS = {
    "players": "Oyuncu Rekorları",
    "clubs": "Kulüp Rekorları",
    "tournaments": "Turnuva Rekorları",
    "awards": "Ödül Rekorları",
    "coaches": "Teknik Direktör Rekorları",
    "transfers": "Transfer / Değer Rekorları",
    "goalkeepers": "Kaleci Rekorları",
    "ilkonbir": "İlkonbir Verileri",
}


@lru_cache(maxsize=1)
def load_seed_records() -> list[dict[str, Any]]:
    with DATA_PATH.open("r", encoding="utf-8") as fh:
        payload = json.load(fh)
    return payload.get("categories", [])


def summarize_record(record: dict[str, Any]) -> dict[str, Any]:
    entries = record.get("entries") or []
    leader = entries[0] if entries else None
    return {
        "id": record["id"],
        "title": record["title"],
        "group": record["group"],
        "group_id": record.get("group_id"),
        "description": record.get("description"),
        "metric_label": record.get("metric_label"),
        "unit": record.get("unit"),
        "verification_status": record.get("verification_status", "needs_review"),
        "updated_at": record.get("updated_at"),
        "source_names": [source.get("name") for source in record.get("sources", [])],
        "entry_count": len(entries),
        "leader": leader,
    }


def get_record(record_id: str) -> dict[str, Any] | None:
    return next((record for record in load_seed_records() if record.get("id") == record_id), None)


def list_groups() -> list[dict[str, str]]:
    seen: dict[str, str] = {}
    for record in load_seed_records():
        group_id = record.get("group_id") or "other"
        seen[group_id] = record.get("group") or GROUP_LABELS.get(group_id, group_id)
    seen.setdefault("ilkonbir", GROUP_LABELS["ilkonbir"])
    return [{"id": key, "title": value} for key, value in seen.items()]


def filter_records(group_id: str | None = None, q: str | None = None) -> list[dict[str, Any]]:
    records = load_seed_records()
    if group_id:
        records = [record for record in records if record.get("group_id") == group_id]
    if q:
        needle = q.casefold()
        records = [
            record
            for record in records
            if needle in record.get("title", "").casefold()
            or needle in record.get("description", "").casefold()
            or any(needle in (entry.get("name") or "").casefold() for entry in record.get("entries", []))
        ]
    return records


async def computed_records(session: AsyncSession) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    records.append(await _most_valuable_players(session))
    records.append(await _most_valuable_clubs(session))
    records.append(await _registered_goals(session))
    records.append(await _registered_assists(session))
    records.append(await _youngest_players(session))
    records.append(await _oldest_players(session))
    return [record for record in records if record["entries"]]


def _computed_base(record_id: str, title: str, description: str, metric_label: str, unit: str):
    return {
        "id": record_id,
        "title": title,
        "group": GROUP_LABELS["ilkonbir"],
        "group_id": "ilkonbir",
        "description": description,
        "metric_label": metric_label,
        "unit": unit,
        "verification_status": "computed",
        "updated_at": None,
        "sources": [{"name": "İlkonbir DB", "url": None, "type": "computed"}],
        "entries": [],
    }


def _entry(rank: int, name: str, value: int | None, display_value: str, **extra):
    return {
        "rank": rank,
        "name": name,
        "country": extra.get("country"),
        "club_or_team": extra.get("club_or_team"),
        "value": value,
        "display_value": display_value,
        "note": extra.get("note"),
        "image_url": extra.get("image_url"),
        "linked_player_id": extra.get("linked_player_id"),
        "linked_club_id": extra.get("linked_club_id"),
        "source_note": "İlkonbir veritabanından hesaplandı.",
        "verification_status": "computed",
    }


async def _most_valuable_players(session: AsyncSession) -> dict[str, Any]:
    record = _computed_base(
        "ilkonbir_most_valuable_players",
        "İlkonbir'deki En Değerli Oyuncular",
        "Mevcut veritabanındaki güncel piyasa değerlerine göre oyuncu liderleri.",
        "Piyasa Değeri",
        "EUR",
    )
    rows = (
        await session.execute(
            select(Player)
            .options(selectinload(Player.club))
            .where(Player.market_value.isnot(None))
            .order_by(Player.market_value.desc())
            .limit(10)
        )
    ).scalars().all()
    for rank, player in enumerate(rows, 1):
        record["entries"].append(
            _entry(
                rank,
                player.name,
                player.market_value,
                _format_eur(player.market_value),
                country=player.nationality,
                club_or_team=player.club.name if player.club else None,
                image_url=player.photo_url,
                linked_player_id=player.id,
            )
        )
    return record


async def _most_valuable_clubs(session: AsyncSession) -> dict[str, Any]:
    record = _computed_base(
        "ilkonbir_most_valuable_clubs",
        "İlkonbir'deki En Değerli Kulüpler",
        "Mevcut kadro piyasa değerleri toplanarak hesaplanan kulüp liderleri.",
        "Kadro Değeri",
        "EUR",
    )
    total = func.coalesce(func.sum(Player.market_value), 0).label("total")
    rows = (
        await session.execute(
            select(Club, total)
            .join(Player, Player.club_id == Club.id)
            .group_by(Club.id)
            .having(total > 0)
            .order_by(total.desc())
            .limit(10)
        )
    ).all()
    for rank, (club, value) in enumerate(rows, 1):
        record["entries"].append(
            _entry(
                rank,
                club.name,
                int(value),
                _format_eur(int(value)),
                country=club.country,
                club_or_team=club.league,
                image_url=club.logo_url,
                linked_club_id=club.id,
            )
        )
    return record


async def _registered_goals(session: AsyncSession) -> dict[str, Any]:
    return await _registered_stat(
        session,
        "ilkonbir_registered_goals",
        "Veritabanı Toplam Gol Liderleri",
        "Sadece İlkonbir DB'de kayıtlı sezon/lig verilerinin toplamıdır; gerçek kariyer toplamı değildir.",
        PlayerSeasonStat.goals,
        "Gol",
        "gol",
    )


async def _registered_assists(session: AsyncSession) -> dict[str, Any]:
    return await _registered_stat(
        session,
        "ilkonbir_registered_assists",
        "Veritabanı Toplam Asist Liderleri",
        "Sadece İlkonbir DB'de kayıtlı sezon/lig verilerinin toplamıdır; gerçek kariyer toplamı değildir.",
        PlayerSeasonStat.assists,
        "Asist",
        "asist",
    )


async def _registered_stat(
    session: AsyncSession,
    record_id: str,
    title: str,
    description: str,
    column,
    metric_label: str,
    unit: str,
) -> dict[str, Any]:
    record = _computed_base(record_id, title, description, metric_label, unit)
    total = func.sum(column).label("total")
    rows = (
        await session.execute(
            select(
                PlayerSeasonStat.player_id,
                PlayerSeasonStat.name,
                PlayerSeasonStat.photo_url,
                PlayerSeasonStat.club_name,
                total,
            )
            .group_by(PlayerSeasonStat.player_id, PlayerSeasonStat.name, PlayerSeasonStat.photo_url, PlayerSeasonStat.club_name)
            .having(total > 0)
            .order_by(total.desc())
            .limit(10)
        )
    ).all()
    for rank, (player_id, name, photo_url, club_name, value) in enumerate(rows, 1):
        value = int(value or 0)
        record["entries"].append(
            _entry(
                rank,
                name,
                value,
                f"{value} {unit}",
                club_or_team=club_name,
                image_url=photo_url,
                linked_player_id=player_id,
                note="Kayıtlı toplam; gerçek kariyer toplamı olarak okunmamalı.",
            )
        )
    return record


async def _youngest_players(session: AsyncSession) -> dict[str, Any]:
    record = _computed_base(
        "ilkonbir_youngest_players",
        "İlkonbir'deki En Genç Oyuncular",
        "Mevcut DB oyuncu yaş alanına göre en genç oyuncular.",
        "Yaş",
        "yaş",
    )
    rows = (
        await session.execute(
            select(Player).options(selectinload(Player.club)).where(Player.age.isnot(None)).order_by(Player.age.asc()).limit(10)
        )
    ).scalars().all()
    for rank, player in enumerate(rows, 1):
        record["entries"].append(
            _entry(
                rank,
                player.name,
                player.age,
                f"{player.age} yaş",
                country=player.nationality,
                club_or_team=player.club.name if player.club else None,
                image_url=player.photo_url,
                linked_player_id=player.id,
            )
        )
    return record


async def _oldest_players(session: AsyncSession) -> dict[str, Any]:
    record = _computed_base(
        "ilkonbir_oldest_players",
        "İlkonbir'deki En Yaşlı Oyuncular",
        "Mevcut DB oyuncu yaş alanına göre en yaşlı oyuncular.",
        "Yaş",
        "yaş",
    )
    rows = (
        await session.execute(
            select(Player).options(selectinload(Player.club)).where(Player.age.isnot(None)).order_by(Player.age.desc()).limit(10)
        )
    ).scalars().all()
    for rank, player in enumerate(rows, 1):
        record["entries"].append(
            _entry(
                rank,
                player.name,
                player.age,
                f"{player.age} yaş",
                country=player.nationality,
                club_or_team=player.club.name if player.club else None,
                image_url=player.photo_url,
                linked_player_id=player.id,
            )
        )
    return record


def _format_eur(value: int | None) -> str:
    if value is None:
        return "-"
    if value >= 1_000_000_000:
        return f"€{value / 1_000_000_000:.2f}B"
    if value >= 1_000_000:
        return f"€{value / 1_000_000:.0f}M"
    if value >= 1_000:
        return f"€{value / 1_000:.0f}K"
    return f"€{value}"
