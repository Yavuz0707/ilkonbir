"""Backfill player photos from three sources.

Order:
  1. API-Football /players/squads (clubs with an API-Football team id)
  2. transfermarkt-api /players/{id}/profile imageUrl
  3. Wikidata P18 -> Wikimedia Commons Special:FilePath

Examples:
    python backfill_player_photos.py
    python backfill_player_photos.py --tm-limit 200 --wikidata-limit 100
"""

import argparse
import asyncio

from app.database import async_session_maker
from app.services.player_photos import (
    player_photo_counts,
    propagate_player_photos_to_stats,
    sync_player_photos_from_api_football,
    sync_player_photos_from_transfermarkt_profiles,
    sync_player_photos_from_wikidata,
)


def _line(label: str, before: tuple[int, int, int], after: tuple[int, int, int]) -> str:
    _, before_with, _ = before
    total, after_with, after_missing = after
    return (
        f"{label}: {before_with} -> {after_with} players with photos "
        f"(+{after_with - before_with}), missing {after_missing}/{total}"
    )


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-api-football", action="store_true")
    parser.add_argument("--skip-transfermarkt", action="store_true")
    parser.add_argument("--skip-wikidata", action="store_true")
    parser.add_argument("--api-football-max-clubs", type=int)
    parser.add_argument("--tm-limit", type=int)
    parser.add_argument("--wikidata-limit", type=int)
    parser.add_argument("--wikidata-offset", type=int, default=0)
    parser.add_argument("--api-football-delay", type=float, default=15.0)
    parser.add_argument("--tm-delay", type=float, default=1.0)
    parser.add_argument("--wikidata-delay", type=float, default=1.0)
    args = parser.parse_args()

    async with async_session_maker() as session:
        counts = await player_photo_counts(session)
        print(f"Start: {counts[1]} with photos, {counts[2]} missing / {counts[0]} total")

        if not args.skip_api_football:
            before = counts
            added = await sync_player_photos_from_api_football(
                session,
                delay_seconds=args.api_football_delay,
                max_clubs=args.api_football_max_clubs,
            )
            counts = await player_photo_counts(session)
            print(_line("Step 1 API-Football", before, counts) + f" (written: {added})")

        if not args.skip_transfermarkt:
            before = counts
            added = await sync_player_photos_from_transfermarkt_profiles(
                session,
                limit=args.tm_limit,
                delay_seconds=args.tm_delay,
            )
            counts = await player_photo_counts(session)
            print(_line("Step 2 transfermarkt-api", before, counts) + f" (written: {added})")

        if not args.skip_wikidata:
            before = counts
            added = await sync_player_photos_from_wikidata(
                session,
                limit=args.wikidata_limit,
                offset=args.wikidata_offset,
                delay_seconds=args.wikidata_delay,
            )
            counts = await player_photo_counts(session)
            print(_line("Step 3 Wikidata/Commons", before, counts) + f" (written: {added})")

        stats_updated = await propagate_player_photos_to_stats(session)
        await session.commit()
        counts = await player_photo_counts(session)
        print(f"Stat photo links updated: {stats_updated}")
        print(f"Final: {counts[1]} with photos, {counts[2]} missing / {counts[0]} total")


if __name__ == "__main__":
    asyncio.run(main())
