"""Tüm Süper Lig kulüplerinin kadro+teknik direktör verisini yeniden çeker
(güncel transferleri yakalamak için). Bağımsız (uvicorn'dan izole).

    python run_full_clubs_sync.py
"""

import asyncio

from app.database import async_session_maker
from app.services.api_football import sync_clubs_and_players


async def main() -> None:
    async with async_session_maker() as session:
        print(await sync_clubs_and_players(session))


if __name__ == "__main__":
    asyncio.run(main())
