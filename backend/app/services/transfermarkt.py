"""Piyasa degeri senkronizasyonu — felipeall/transfermarkt-api servisi uzerinden.

Strateji: her oyuncu icin tek tek arama yapmak yerine kulup bazli calisir:
  1. Kulup adiyla transfermarkt kulubu bulunur (fuzzy match, rapidfuzz).
  2. O kulubun oyuncu listesi tek istekle cekilir (piyasa degerleriyle birlikte).
  3. DB'deki her oyuncu, isim benzerligiyle (token_set_ratio) listeye eslestirilir.

Boylece scraping tabanli servise kulup basina ~2 istek atilir; oyuncu basina degil.
"""

import asyncio
import logging
from datetime import datetime, timezone

import httpx
from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import get_settings
from ..models import Club, Player

logger = logging.getLogger(__name__)

_CLUB_MATCH_THRESHOLD = 80
_PLAYER_MATCH_THRESHOLD = 78
# İsmi tam adla degistirmek icin daha yuksek guven esigi (yanlis yeniden
# adlandirmayi onlemek icin)
_NAME_UPDATE_THRESHOLD = 85


def _norm(name: str) -> str:
    replacements = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    return name.translate(replacements).lower().strip()


# football-data.org'un resmi tam adlari ("FC Internazionale Milano", "Stade
# Rennais FC 1901") transfermarkt'in arama indeksinde sik sik SIFIR sonuc
# donduruyor; kisaltilmis/kuruluş-yili-siz hali ("Inter", "Stade Rennais")
# genelde eslesiyor. Bu yuzden ilk arama bos/dusuk skorlu donerse basitlestirilmis
# isimle ikinci bir deneme yapilir.
_CLUB_NAME_STOPWORDS = {
    "fc", "cf", "afc", "ac", "as", "ssc", "acf", "us", "usd", "uc", "rc", "cd",
    "sd", "sc", "osc", "bc", "ca", "de", "club", "calcio", "futbol",
}


def _simplify_club_name(name: str) -> str:
    tokens = [t for t in name.split() if not t.isdigit() and t.lower() not in _CLUB_NAME_STOPWORDS]
    simplified = " ".join(tokens).strip()
    return simplified if simplified and simplified.lower() != name.lower() else ""


# football-data.org adlari icin genel basitlestirme yetersiz kalan kulupler
# (elle test edilip transfermarkt-api'de gercekten calistigi dogrulanmis
# takma isimler). "FC Internazionale Milano" -> "Inter" bekleniyordu ama
# transfermarkt'in arama uctu tuhaf sekilde BUYUK harfle "Inter" icin 0 sonuc
# donduruyor (kucuk harf "inter" calisiyor, ama "Internazionale" her ikisinde
# de guvenilir calistigi icin o tercih edildi).
_CLUB_NAME_ALIASES: dict[str, str] = {
    "1. FC Heidenheim 1846": "Heidenheim",
    "1. FSV Mainz 05": "Mainz 05",
    "AC Pisa 1909": "Pisa",
    "FC Internazionale Milano": "Internazionale",
    "Racing Club de Lens": "RC Lens",
}


async def _search_clubs(client: httpx.AsyncClient, query: str) -> list[dict]:
    resp = await client.get(f"/clubs/search/{query}")
    if resp.status_code != 200:
        return []
    return resp.json().get("results", [])


def _best_from_results(results: list[dict], club: Club) -> tuple[int | None, float]:
    best_id, best_score = None, 0.0
    for r in results:
        score = fuzz.token_set_ratio(_norm(club.name), _norm(r.get("name", "")))
        country = (r.get("country") or "").lower()
        if club.country and country and club.country.lower() != country:
            score -= 15  # ayni isimli farkli ulke kulubu cezasi
        if score > best_score:
            best_id, best_score = r.get("id"), score
    return best_id, best_score


async def _find_club_id(client: httpx.AsyncClient, club: Club) -> int | None:
    best_id, best_score = _best_from_results(await _search_clubs(client, club.name), club)

    if best_score < _CLUB_MATCH_THRESHOLD:
        alias = _CLUB_NAME_ALIASES.get(club.name)
        if alias:
            alt_id, alt_score = _best_from_results(await _search_clubs(client, alias), club)
            if alt_score > best_score:
                best_id, best_score = alt_id, alt_score

    if best_score < _CLUB_MATCH_THRESHOLD:
        simplified = _simplify_club_name(club.name)
        if simplified:
            alt_id, alt_score = _best_from_results(await _search_clubs(client, simplified), club)
            if alt_score > best_score:
                best_id, best_score = alt_id, alt_score

    if best_score >= _CLUB_MATCH_THRESHOLD and best_id is not None:
        return int(best_id)
    logger.info("Transfermarkt kulup eslesmesi bulunamadi: %s (skor %.0f)", club.name, best_score)
    return None


def _parse_value(raw) -> int | None:
    """API int (EUR) ya da '€90.00m' benzeri string dondurebilir; ikisini de isle."""
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return int(raw)
    text = str(raw).lower().replace("€", "").replace(",", ".").strip()
    mult = 1
    if text.endswith("bn"):
        mult, text = 1_000_000_000, text[:-2]
    elif text.endswith("m"):
        mult, text = 1_000_000, text[:-1]
    elif text.endswith("k"):
        mult, text = 1_000, text[:-1]
    try:
        return int(float(text) * mult)
    except ValueError:
        return None


async def sync_market_values(session: AsyncSession, club_ids: list[int] | None = None) -> str:
    """Tum kuluplerin (ya da verilen `club_ids` alt kumesinin) oyuncularina
    transfermarkt piyasa degerlerini yazar.

    NOT: Kulup ID'leri once duz bir listeye alinir, her iterasyonda kulup
    `session.get` ile TAZE cekilir. Bir onceki kulupte httpx hatasi olup
    `session.rollback()` calisirsa, rollback session'daki TUM nesneleri expire
    eder; onceden yuklenmis bir ORM nesnesi listesi uzerinde iterasyona devam
    etmek, sonraki kulubun attribute erisiminde senkron lazy-load tetikleyip
    "MissingGreenlet" hatasiyla cokerdi (96 kulupluk sync'te canli tespit edildi).
    """
    settings = get_settings()
    updated = skipped = 0

    stmt = select(Club.id)
    if club_ids is not None:
        stmt = stmt.where(Club.id.in_(club_ids))
    club_ids = (await session.execute(stmt)).scalars().all()

    async with httpx.AsyncClient(base_url=settings.transfermarkt_api_url, timeout=60) as client:
        for club_id in club_ids:
            club = await session.get(Club, club_id, options=[selectinload(Club.players)])
            try:
                if club.transfermarkt_id is None:
                    club.transfermarkt_id = await _find_club_id(client, club)
                    await asyncio.sleep(1)
                if club.transfermarkt_id is None:
                    skipped += len(club.players)
                    continue

                resp = await client.get(f"/clubs/{club.transfermarkt_id}/players")
                if resp.status_code != 200:
                    skipped += len(club.players)
                    continue
                tm_players = resp.json().get("players", [])

                for player in club.players:
                    match, score = _best_player_match(player, tm_players)
                    if match is None:
                        skipped += 1
                        continue
                    # Guvenilir eslesmede API'nin kisaltilmis adini ("V. Osimhen")
                    # transfermarkt tam adiyla ("Victor Osimhen") degistir
                    tm_name = match.get("name")
                    if tm_name and score >= _NAME_UPDATE_THRESHOLD:
                        player.name = tm_name
                    tm_id = match.get("id")
                    player.transfermarkt_id = int(tm_id) if tm_id else None
                    value = _parse_value(match.get("marketValue"))
                    if value is not None:
                        player.market_value = value
                        player.market_value_updated_at = datetime.now(timezone.utc)
                    updated += 1

                await session.commit()
                # Scraping tabanli servise nazik davran
                await asyncio.sleep(2)
            except httpx.HTTPError as exc:
                logger.warning("Transfermarkt istegi basarisiz (%s): %s", club.name, exc)
                await session.rollback()

    return f"{updated} oyuncunun piyasa degeri guncellendi, {skipped} oyuncu eslesmedi."


def _tokens(name: str) -> list[str]:
    return [t for t in _norm(name).replace(".", " ").split() if t]


def _name_score(api_name: str, tm_name: str) -> float:
    """API-Football kisaltilmis isimlerini ("V. Osimhen") transfermarkt tam
    isimlerine ("Victor Osimhen") esler.

    Soyad benzerligi agirlikli; ilk isim kisaltma ise yalnizca bas harf
    kontrol edilir. Ayrica klasik token_set_ratio ile kiyaslanip yuksek olan
    alinir (isim sirasi farkli durumlar icin).
    """
    a, t = _tokens(api_name), _tokens(tm_name)
    if not a or not t:
        return 0.0
    last = float(fuzz.ratio(a[-1], t[-1]))
    a_first = a[0] if len(a) > 1 else ""
    t_first = t[0] if len(t) > 1 else ""
    if a_first and t_first:
        if len(a_first) <= 2:  # "v." -> bas harf eslesmesi
            first = 100.0 if a_first[0] == t_first[0] else 0.0
        else:
            first = float(fuzz.ratio(a_first, t_first))
    else:
        first = 65.0  # tek isimli oyuncu; notr
    anchored = last * 0.7 + first * 0.3
    return max(anchored, float(fuzz.token_set_ratio(_norm(api_name), _norm(tm_name))))


def _best_player_match(player: Player, tm_players: list[dict]) -> tuple[dict | None, float]:
    best, best_score = None, 0.0
    for tp in tm_players:
        score = _name_score(player.name, tp.get("name", ""))
        if score > best_score:
            best, best_score = tp, score
    if best is not None and best_score >= _PLAYER_MATCH_THRESHOLD:
        return best, best_score
    return None, best_score
