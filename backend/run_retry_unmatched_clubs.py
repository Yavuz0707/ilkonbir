"""transfermarkt_id'si NULL kalan kulüpleri (basitleştirilmiş isim fallback'iyle)
yeniden dener. Bağımsız (uvicorn'dan izole).

    python run_retry_unmatched_clubs.py
"""

import asyncio

from sqlalchemy import select

from app.database import async_session_maker
from app.models import Club
from app.services.transfermarkt import sync_market_values


async def main() -> None:
    async with async_session_maker() as session:
        ids = (
            await session.execute(select(Club.id).where(Club.transfermarkt_id.is_(None)))
        ).scalars().all()
        print(f"{len(ids)} eslesmemis kulup yeniden deneniyor...")
        print(await sync_market_values(session, club_ids=list(ids)))


if __name__ == "__main__":
    asyncio.run(main())
