"""Premier League/La Liga/Bundesliga/Serie A/Ligue 1 kulüp+kadro senkronu,
ardından piyasa değeri (transfermarkt) senkronu. Bağımsız (uvicorn'dan izole).

    python run_foreign_clubs_sync.py
"""

import asyncio

from app.database import async_session_maker
from app.services.football_data_org import sync_foreign_clubs
from app.services.transfermarkt import sync_market_values


async def main() -> None:
    async with async_session_maker() as session:
        print(await sync_foreign_clubs(session))
    async with async_session_maker() as session:
        print(await sync_market_values(session))


if __name__ == "__main__":
    asyncio.run(main())
