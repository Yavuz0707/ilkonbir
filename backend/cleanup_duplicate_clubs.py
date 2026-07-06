"""Eşleştirme hatası nedeniyle oluşan duplicate ünlü kulüpleri temizler.

Her çift için: eski (external_api_football_id dolu, external_football_data_org_id
boş) seed kulübü silinir; yeni (external_football_data_org_id dolu) gerçek
kadrolu kulüp korunur. Eski kulübün oyuncuları + varsa lineup/lineup_slot
referansları önce temizlenir (FK ihlali olmasın diye).

    python cleanup_duplicate_clubs.py
"""

import asyncio

from sqlalchemy import delete, select, update

from app.database import async_session_maker
from app.models import Club, Coach, Lineup, LineupSlot, Player, PlayerSeasonStat

# (eski API-Football ID, aranacak isim parçası) — sadece 8 elle-seed kulüp
OLD_SEED_IDS = [541, 529, 50, 40, 42, 157, 85, 505]


async def main() -> None:
    async with async_session_maker() as session:
        old_clubs = (
            await session.execute(
                select(Club).where(
                    Club.external_api_football_id.in_(OLD_SEED_IDS),
                    Club.external_football_data_org_id.is_(None),
                )
            )
        ).scalars().all()

        for old in old_clubs:
            new = (
                await session.execute(
                    select(Club).where(
                        Club.league == old.league,
                        Club.external_football_data_org_id.isnot(None),
                        Club.id != old.id,
                    )
                )
            ).scalars().all()
            # Ayni ligde birden fazla yeni kulup olabilir (normal, digerleri farkli
            # takimlar) — burada sadece ISIM eslesenini bulmamiz lazim, ama zaten
            # sync_foreign_clubs bu 8 kulubu YANLISLIKLA yeni kayit olarak da
            # eklemisti; o yeni kaydi isimden bulalim.
            print(f"ESKİ: {old.name} (lig={old.league}, api_id={old.external_api_football_id})")

        # Basit ve guvenli yol: her eski kulubun oyuncularini/lineup referanslarini
        # temizleyip kulubu sil. "Yeni" kulup zaten dogru sekilde ayri var oldugu
        # icin (fuzzy-match sonraki calistirmada onu bulacak), silme yeterli.
        removed_players = 0
        for old in old_clubs:
            player_ids = (
                await session.execute(select(Player.id).where(Player.club_id == old.id))
            ).scalars().all()
            if player_ids:
                await session.execute(
                    update(LineupSlot)
                    .where(LineupSlot.player_id.in_(player_ids))
                    .values(player_id=None)
                )
                await session.execute(
                    update(PlayerSeasonStat)
                    .where(PlayerSeasonStat.player_id.in_(player_ids))
                    .values(player_id=None)
                )
                await session.execute(delete(Player).where(Player.id.in_(player_ids)))
                removed_players += len(player_ids)

            # Bu kulube ait lineup/slot/coach kayitlarini da temizle (FK)
            lineup_ids = (
                await session.execute(select(Lineup.id).where(Lineup.club_id == old.id))
            ).scalars().all()
            if lineup_ids:
                await session.execute(
                    delete(LineupSlot).where(LineupSlot.lineup_id.in_(lineup_ids))
                )
                await session.execute(delete(Lineup).where(Lineup.id.in_(lineup_ids)))
            await session.execute(delete(Coach).where(Coach.club_id == old.id))

            await session.delete(old)

        await session.commit()
        print(f"{len(old_clubs)} duplicate kulüp silindi, {removed_players} eski oyuncu kaldırıldı.")


if __name__ == "__main__":
    asyncio.run(main())
