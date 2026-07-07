r"""Kademeli oyuncu/hoca kupa senkronizasyonu.

Kullanim:
    .\.venv\Scripts\python run_trophy_sync.py --limit 20
    .\.venv\Scripts\python run_trophy_sync.py --holder-type coach --limit 10
"""

import argparse
import asyncio

from app.database import async_session_maker
from app.services.api_football import sync_trophies


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--holder-type", choices=["all", "player", "coach"], default="all")
    parser.add_argument("--limit", type=int, default=25)
    args = parser.parse_args()

    async with async_session_maker() as session:
        result = await sync_trophies(session, holder_type=args.holder_type, limit=args.limit)
        print(result)


if __name__ == "__main__":
    asyncio.run(main())
