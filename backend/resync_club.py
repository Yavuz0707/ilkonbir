"""Tek bir kulubu hedefli yeniden senkronize eder (kadro + teknik direktor +
piyasa degerleri). Ana sync sirasinda rate-limit'e denk gelip atlanan kulupler
icin kullanilir.

    python resync_club.py 645        # Galatasaray (API-Football team id)
"""

import asyncio
import sys
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import async_session_maker
from app.models import Club
from app.services.api_football import _client, _sync_coach, _sync_squad
from app.services.transfermarkt import (
    _NAME_UPDATE_THRESHOLD,
    _best_player_match,
    _find_club_id,
    _parse_value,
)


async def resync(external_team_id: int) -> None:
    settings = get_settings()
    async with async_session_maker() as session:
        club = (
            await session.execute(
                select(Club).where(Club.external_api_football_id == external_team_id)
            )
        ).scalar_one_or_none()
        if club is None:
            print(f"Kulup bulunamadi (external id {external_team_id})")
            return

        # 1) Kadro + teknik direktor (API-Football)
        async with _client() as client:
            added, removed = await _sync_squad(client, session, club)
            await _sync_coach(client, session, club)
            await session.commit()
        print(f"{club.name}: {added} oyuncu senkronize, {removed} eski oyuncu kaldirildi")

        # 2) Piyasa degerleri (yerel transfermarkt-api)
        players = (
            (
                await session.execute(
                    select(Club).options(selectinload(Club.players)).where(Club.id == club.id)
                )
            )
            .scalar_one()
            .players
        )
        async with httpx.AsyncClient(base_url=settings.transfermarkt_api_url, timeout=60) as tm:
            if club.transfermarkt_id is None:
                club.transfermarkt_id = await _find_club_id(tm, club)
            if club.transfermarkt_id is None:
                print(f"{club.name}: transfermarkt kulubu eslesmedi, deger atlanadi")
                return
            resp = await tm.get(f"/clubs/{club.transfermarkt_id}/players")
            tm_players = resp.json().get("players", []) if resp.status_code == 200 else []
            updated = 0
            for player in players:
                match, score = _best_player_match(player, tm_players)
                if match is None:
                    continue
                tm_name = match.get("name")
                if tm_name and score >= _NAME_UPDATE_THRESHOLD:
                    player.name = tm_name
                tm_id = match.get("id")
                player.transfermarkt_id = int(tm_id) if tm_id else None
                value = _parse_value(match.get("marketValue"))
                if value is not None:
                    player.market_value = value
                    player.market_value_updated_at = datetime.now(timezone.utc)
                updated += 1
            await session.commit()
        print(f"{club.name}: {updated} oyuncunun piyasa degeri guncellendi")


if __name__ == "__main__":
    team_id = int(sys.argv[1]) if len(sys.argv) > 1 else 645
    asyncio.run(resync(team_id))
