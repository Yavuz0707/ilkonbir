# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

İlk Onbir — a fantasy football lineup builder. Users pick a real club, see its
auto-assembled starting XI on a pitch, swap players in from the bench or from
other clubs, switch formations, and watch total squad market value update live.
Backend: FastAPI + SQLAlchemy async + PostgreSQL/SQLite. Frontend: React (Vite)
+ Tailwind v4 + Framer Motion. No auth — lineups are guest/session-based
(lineup id stored in the browser's `sessionStorage`, keyed per club).

## Commands

### Backend (from `backend/`)
```powershell
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python -m app.seed              # load demo data (10 hand-picked clubs)
.\.venv\Scripts\python -m app.seed --force       # drop all tables and reseed
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
.\.venv\Scripts\alembic revision --autogenerate -m "message"
.\.venv\Scripts\alembic upgrade head
```
No test suite and no linter are configured in this project (no pytest, no ruff/flake8 config).

### Frontend (from `frontend/`)
```powershell
npm install
npm run dev        # Vite dev server, http://localhost:5173
npm run build
```
No test suite or ESLint config is set up on the frontend either.

### Docker
```powershell
docker compose up -d db                    # PostgreSQL
docker compose up -d transfermarkt-api      # felipeall/transfermarkt-api (market values)
```

### Data sync (see "Data sources" below before touching these)
Real data does not flow in automatically — it's pulled via one-off syncs, either
through `POST /admin/sync` (background task inside the running server) or via the
standalone scripts in `backend/` (`run_full_clubs_sync.py`, `run_foreign_clubs_sync.py`,
`run_fdo_sync.py`, `resync_club.py <team_id>`, `run_retry_unmatched_clubs.py`,
`cleanup_duplicate_clubs.py`). Prefer the standalone scripts for anything that takes
more than a few seconds — see the uvicorn `--reload` gotcha below.

## Architecture

### Two independent external data sources, deliberately kept separate

- **API-Football** (`app/services/api_football.py`) syncs Süper Lig clubs/squads/coaches
  (`API_FOOTBALL_LEAGUES=203`) plus goal/assist leaderboards for Süper Lig + the 3 UEFA
  cups (`API_FOOTBALL_STAT_LEAGUES`, separate from the club-sync league list on purpose —
  UEFA cup IDs must never leak into the club sync or they'd create phantom "clubs").
  **The free plan only allows seasons 2022–2024** — `/players/topscorers` and
  `/players/topassists` will silently 403-equivalent on 2025. `/players/squads` and
  `/coachs`, however, are NOT season-gated and always return the current squad/coach —
  don't assume a season lock applies to all endpoints on this API.
- **football-data.org** (`app/services/football_data_org.py`) is the second source, used
  specifically to get the *current* 2025-26 season where API-Football is stuck on
  2024-25: club/squad sync for PL/La Liga/Bundesliga/Serie A/Ligue 1
  (`sync_foreign_clubs`, one HTTP request per league returns ALL teams+squads — much
  cheaper than API-Football's one-request-per-team model), plus a top-scorers sync
  (`sync_football_data_org_scorers`) covering those 5 leagues + Champions League.
  Its `scorers` response includes an `assists` field, but it's frequently `null` and
  sorted by goals, not assists — it is **intentionally discarded** (hardcoded to 0)
  rather than presented as a real assist ranking; see the docstring in that file.
  **Always pass an explicit `season=` param to football-data.org** — without it, the
  API auto-picks "the current season" by calendar, which during the summer transfer
  window resolves to next season (not yet started, zero data).

Because two sources both populate `Club`/`Player`, each has its **own external-id
column** (`external_api_football_id`, `external_football_data_org_id`) rather than
sharing one, to keep the ID spaces from colliding. When adding a third source, follow
this pattern instead of overloading an existing id column.

`PlayerSeasonStat` similarly carries a `source` field baked into its unique
constraint, since API-Football and football-data.org use incompatible league-id
numbering for the same competition (e.g. Champions League appears as two separate
rows, one per source, each with its own season vintage — this is intentional, not
a dedup bug, and the frontend's league picker shows both with a season sub-label).

### Squad sync is diff-based, not additive

Both `sync_clubs_and_players` (API-Football) and `sync_foreign_clubs`
(football-data.org) fully replace a club's roster on every run: they diff the
freshly-fetched squad against what's in the DB and delete players no longer
present (nulling any `LineupSlot.player_id` that pointed at them first). This is
how transferred-out players disappear automatically. When writing a new sync
function, follow the same diff/delete pattern rather than only inserting/updating.

### Club matching must not assume seed clubs have no external id

`seed_data.py` hardcodes plausible-looking real API-Football team IDs for its 8
demo foreign clubs (Real Madrid, Barcelona, Arsenal, Man City, Liverpool, Bayern,
PSG, Inter) even though those clubs were never actually synced from API-Football.
A club-matching query that filters `WHERE external_api_football_id IS NULL` to
find "unclaimed seed clubs" will wrongly skip these 8 and create duplicates — filter
on the external id column of the source you're actually matching against instead.

### Auto-lineup assignment (`app/services/lineup_service.py`)

`build_default_assignment` fills formation slots by matching each player's
`detail_position` (Turkish label, e.g. "Stoper", "Sol Kanat", "Merkez Orta Saha")
against the formation slot's `label`, in tiers (exact label → same side →
neutral → wrong side), tie-broken by `market_value` descending. Because the
matching is label-string-based, any new position mapping (e.g. when adding a
third data source) must emit these same Turkish labels — see `_POSITION_MAP` in
`football_data_org.py` and `_DETAIL_MAP`/`_POSITION_MAP` in `api_football.py` for
the two existing translation tables. `remap_assignment` handles formation
switches: same slot key first, then role-compatible leftovers, then anything left.

### `sync_market_values` (transfermarkt.py) session-expiry gotcha

Fetches all club ids up front, then re-fetches each club fresh with `session.get()`
inside the loop — **do not** go back to loading the whole `Club` list once and
iterating over those ORM objects across multiple commits. A single club's httpx
error triggers `session.rollback()`, which expires every object loaded in that
session; touching an attribute on a different, previously-loaded object after
that raises `MissingGreenlet` (only shows up at scale — was invisible with <30
clubs, broke immediately at 96+). `_find_club_id` also does a second search
attempt with a simplified club name (stopwords/founding-year stripped) when the
literal name returns nothing — many football-data.org official names ("FC
Internazionale Milano") don't match transfermarkt's index at all.

### Formation/pitch coordinates

`Formation.position_slots` is a JSON list of `{key, label, role, x, y}`, x/y as
percentages for absolute positioning on the pitch SVG (`PitchBackground.jsx`).
`formations_data.py` is the source of truth for the 5 built-in formations
(4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 3-4-3); adding a formation there is enough — no
frontend changes needed since slots render generically from this data.

### Frontend routing quirk

`App.jsx` keys `<Routes>` on `location.pathname` so every navigation fully
remounts the page tree (enables the Framer Motion page-transition animations) —
don't rely on component state surviving a route change. The lineup page
(`/club/:clubId`) hides the top nav header entirely for a full-screen pitch
experience; other pages show it.

### Background sync tasks die on `uvicorn --reload`

Editing any backend `.py` file (even an unrelated one) while a long-running sync
is executing inside a `BackgroundTasks`-triggered coroutine kills it silently —
`--reload` restarts the whole process. For anything that takes more than a few
seconds, run one of the standalone `run_*_sync.py` scripts as a separate process
instead of hitting `POST /admin/sync` while you still intend to edit code.
