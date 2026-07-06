"""Bağımsız (uvicorn'dan izole) top_stats + transfers senkronizasyonu.

Arka plan görevleri uvicorn reload'da ölüyor; bu script ayrı process olduğu
için etkilenmez. Transfers'te zaten kaydı olan kulüpleri atlar (kota tasarrufu).

    python run_extra_sync.py
"""

import asyncio

from sqlalchemy import select

from app.database import async_session_maker
from app.models import Club, Player, Transfer
from app.services.api_football import (
    _client,
    _get,
    _store_transfers,
    sync_top_stats,
)

SINCE = "2024-07-01"


async def main() -> None:
    async with async_session_maker() as session:
        # 1) Gol/asist krallığı (tam isim iyileştirmesiyle)
        print(await sync_top_stats(session))

        # 2) Transfers — yalnızca henüz kaydı olmayan kulüpler
        club_rows = (
            await session.execute(
                select(Club.external_api_football_id)
                .join(Player, Player.club_id == Club.id)
                .where(
                    Club.external_api_football_id.isnot(None),
                    Player.external_api_football_id.isnot(None),
                )
                .distinct()
            )
        ).scalars().all()

        done = set(
            (
                await session.execute(
                    select(Transfer.external_player_id)
                )
            ).scalars().all()
        )
        # Kulübün oyuncularından herhangi biri transfers'te varsa o kulüp işlenmiş sayılır
        stored = 0
        async with _client() as client:
            for ext_team_id in club_rows:
                # Bu kulübün oyuncularından biri zaten transfers'te mi?
                player_ids = (
                    await session.execute(
                        select(Player.external_api_football_id)
                        .join(Club, Player.club_id == Club.id)
                        .where(Club.external_api_football_id == ext_team_id)
                    )
                ).scalars().all()
                if any(pid in done for pid in player_ids):
                    continue  # bu kulüp zaten işlenmiş
                try:
                    rows = await _get(client, "/transfers", {"team": ext_team_id})
                    for item in rows:
                        stored += await _store_transfers(session, item, SINCE)
                    await session.commit()
                    print(f"  team {ext_team_id}: +transferler")
                except Exception as exc:  # noqa: BLE001
                    print(f"  team {ext_team_id} atlandı: {exc}")
                    await session.rollback()
                await asyncio.sleep(15)
        print(f"Transfers: {stored} yeni kayıt eklendi.")


if __name__ == "__main__":
    asyncio.run(main())
