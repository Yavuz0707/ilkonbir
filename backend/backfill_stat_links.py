"""PlayerSeasonStat.player_id backfill — mevcut stat kayitlarini Player'a baglar.

Neden: gol/asist stat satirlarinin cogunda `player_id` NULL kalmisti (fdo scorer
sync yalnizca isimle esliyordu ve cogu tutmuyordu; api_football sync ise capraz
kaynak oyunculari kaciriyordu). Bu, "Kim Daha İyi?" oyununun goals/assists
havuzunu pratikte yalnizca Süper Lig'e daraltiyordu. Bu script external-id
oncelikli + soyad-cipali isim yedegi ile TUM kayitlari yeniden baglar.

API'ye HIC istek atmaz — yalnizca DB uzerinde calisir.

    python backfill_stat_links.py            # uygula
    python backfill_stat_links.py --dry-run  # sadece raporla, yazma
"""

import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import async_session_maker
from app.models import Player, PlayerSeasonStat
from app.services.stat_linking import build_id_maps, link_player


async def backfill(dry_run: bool = False) -> None:
    async with async_session_maker() as session:
        players = (
            (await session.execute(select(Player).options(selectinload(Player.club))))
            .scalars()
            .all()
        )
        by_af_id, by_fdo_id = build_id_maps(players)

        stats = (await session.execute(select(PlayerSeasonStat))).scalars().all()

        changed = 0
        linked_exact = linked_name = unlinked = 0
        for s in stats:
            before = s.player_id
            match = link_player(
                s.source, s.external_player_id, s.name, s.club_name, players, by_af_id, by_fdo_id
            )
            new_id = match.id if match else None
            # Kaynak-tutarli external-id eslesmesi mi yoksa isim yedegi mi?
            src_map = by_fdo_id if s.source == "football_data_org" else by_af_id
            if match is not None and src_map.get(s.external_player_id) is match:
                linked_exact += 1
            elif match is not None:
                linked_name += 1
            else:
                unlinked += 1

            if new_id != before:
                changed += 1
                if match is not None:
                    # denormalize alanlari da tazele (isim/foto Player'dan)
                    s.player_id = match.id
                    if match.name:
                        s.name = match.name
                    if match.photo_url:
                        s.photo_url = match.photo_url
                else:
                    s.player_id = None

        print(
            f"Toplam {len(stats)} stat | external-id ile bagli: {linked_exact} | "
            f"isim yedegi ile bagli: {linked_name} | baglanamayan: {unlinked} | "
            f"degisen: {changed}"
        )
        if dry_run:
            print("DRY-RUN — hicbir sey yazilmadi.")
            await session.rollback()
        else:
            await session.commit()
            print("Yazildi.")


if __name__ == "__main__":
    asyncio.run(backfill(dry_run="--dry-run" in sys.argv))
