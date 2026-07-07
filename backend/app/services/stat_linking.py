"""PlayerSeasonStat -> Player baglama (linking) mantigi — tek kaynak.

Iki veri kaynagi (api_football, football_data_org) ayni gercek oyuncuyu FARKLI
`external_player_id` ile temsil eder ve `Player` tablosunda oyuncunun yalnizca
TEK external id sutunu dolu olur (hangi kaynaktan sync edildiyse). Bu yuzden
baglama iki asamalidir:

  1. KESIN: stat satirinin kaynagina gore dogru external-id sutunuyla eslestir
     (fdo -> Player.external_football_data_org_id, af -> external_api_football_id).
     Bu, oyuncunun kendi kaynagindan gelen kayitlarini %100 dogru baglar.
  2. YEDEK (capraz-kaynak): oyuncunun Player kaydi DIGER kaynaktan geldiginde
     external id eslesmez (orn. Süper Lig'e transfer olmus Osimhen'in fdo Şampiyonlar
     Ligi kaydi). Bu durumda soyad-cipali isim eslesmesi kullanilir — kisaltilmis
     adlari ("E. Haaland" -> "Erling Haaland", "H. Kane" -> "Harry Kane") dogru
     esler; duz token_set_ratio bunlarda basarisiz olur.
"""

from rapidfuzz import fuzz

from ..models import Player

# Kisaltilmis olmayan ilk isimlerde kabul edilen minimum benzerlik.
_FIRST_NAME_RATIO = 85


def norm(name: str) -> str:
    replacements = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    return name.translate(replacements).lower().strip()


def _tokens(name: str) -> list[str]:
    return [t for t in norm(name).replace(".", " ").split() if t]


def _first_names_compatible(a_first: str, b_first: str) -> bool:
    """Iki ilk isim ayni oyuncuya ait olabilir mi? Kisaltma ("e.") ise yalnizca
    bas harf; degilse yakin benzerlik (yazim farki toleransi) aranir."""
    if not a_first or not b_first:
        return True  # taraflardan biri tek isimli -> soyad eslesmesi yeterli
    if len(a_first) <= 2 or len(b_first) <= 2:
        return a_first[0] == b_first[0]
    return a_first == b_first or fuzz.ratio(a_first, b_first) >= _FIRST_NAME_RATIO


def _name_match(name: str, club_name: str | None, players: list[Player]) -> Player | None:
    """Capraz-kaynak isim eslesmesi — YANLIS baglamaya karsi bilincli olarak katı:

      * Soyad TAM eşit olmalı (normalize sonrası). Boylece "Thiam"≠"Thiaw",
        "Kara"≠"Kamara" gibi benzer-yazimli farkli oyuncular reddedilir.
      * Ilk isim uyumlu olmali (kisaltmada bas harf, degilse yakin benzerlik).
      * Ayni soyad+ilk-isimli birden fazla aday varsa kulup adiyla ayirt edilir;
        net bir kazanan yoksa (belirsiz) hic baglanmaz — yanlis baglamaktansa
        baglamamak yeglenir.
    """
    a = _tokens(name)
    if not a:
        return None
    a_mono = len(a) == 1
    a_last = a[-1]
    a_first = a[0] if len(a) > 1 else ""
    target_club = norm(club_name) if club_name else None

    candidates: list[tuple[float, Player]] = []
    for p in players:
        b = _tokens(p.name)
        if not b:
            continue
        # Tek-isimli oyuncu (mononim) yalnizca tek-isimliyle ve TAM esitlikle
        # eslesir; "João Pedro" -> "Pedro" gibi capraz mono/multi tuzaklarini onler.
        if a_mono != (len(b) == 1):
            continue
        if a_mono:
            if b[0] != a_last:
                continue
        else:
            if b[-1] != a_last or not _first_names_compatible(a_first, b[0]):
                continue
        club_score = -1.0
        if target_club and p.club and p.club.name:
            club_score = float(fuzz.token_set_ratio(target_club, norm(p.club.name)))
        candidates.append((club_score, p))

    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0][1]
    candidates.sort(key=lambda c: c[0], reverse=True)
    # Kulup skoru net ustunse onu sec; degilse belirsiz -> baglama
    if candidates[0][0] > candidates[1][0]:
        return candidates[0][1]
    return None


def link_player(
    source: str,
    ext: int | None,
    name: str,
    club_name: str | None,
    players: list[Player],
    by_af_id: dict[int, Player],
    by_fdo_id: dict[int, Player],
) -> Player | None:
    """Bir stat satirini Player'a baglar: once kesin external-id, sonra isim yedegi."""
    if ext is not None:
        exact = (by_fdo_id if source == "football_data_org" else by_af_id).get(ext)
        if exact is not None:
            return exact
    return _name_match(name, club_name, players)


def build_id_maps(players: list[Player]) -> tuple[dict[int, Player], dict[int, Player]]:
    by_af_id = {p.external_api_football_id: p for p in players if p.external_api_football_id}
    by_fdo_id = {
        p.external_football_data_org_id: p for p in players if p.external_football_data_org_id
    }
    return by_af_id, by_fdo_id
