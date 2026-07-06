"""Yanlış eşleştirme algoritması yüzünden kirlenmiş yabancı-kulüp API-Football
bağlantılarını + koç kayıtlarını temizler (temiz baştan başlamak için).

    python reset_foreign_coach_links.py
"""

import asyncio

from sqlalchemy import delete, select, update

from app.database import async_session_maker
from app.models import Club, Coach

_FOREIGN_LEAGUES = ["Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1"]


async def main() -> None:
    async with async_session_maker() as session:
        club_ids = (
            await session.execute(select(Club.id).where(Club.league.in_(_FOREIGN_LEAGUES)))
        ).scalars().all()

        await session.execute(delete(Coach).where(Coach.club_id.in_(club_ids)))
        await session.execute(
            update(Club).where(Club.id.in_(club_ids)).values(external_api_football_id=None)
        )
        await session.commit()
        print(f"{len(club_ids)} yabancı kulübün API-Football bağlantısı+koçu sıfırlandı.")


if __name__ == "__main__":
    asyncio.run(main())
