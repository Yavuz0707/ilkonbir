"""Dizilis kurma/donusturme mantigi.

- build_default_assignment: kadrodan, formasyon slot rollerine gore piyasa degeri
  en yuksek oyuncularla otomatik ilk onbir kurar.
- remap_assignment: formasyon degisince mevcut oyunculari rol bazli koruyarak
  yeni slotlara dagitir.
"""

from ..models import Formation, Player

# Bir rolde yeterli oyuncu yoksa su sirayla komsu rollerden tamamlanir
_FALLBACK_ROLES: dict[str, list[str]] = {
    "GK": ["GK"],
    "DF": ["DF", "MF", "FW"],
    "MF": ["MF", "FW", "DF"],
    "FW": ["FW", "MF", "DF"],
}


def _value(p: Player) -> int:
    return p.market_value or 0


def _side(text: str) -> str | None:
    if "Sol" in text:
        return "Sol"
    if "Sağ" in text:
        return "Sağ"
    return None


# "Merkez Orta Saha" slotu tum merkez orta saha profillerini kabul eder
_CENTRAL_MF = {"Merkez Orta Saha", "Ön Libero", "On Numara"}


def _match_tier(player: Player, slot: dict) -> int:
    """0 = tam uyum ... 3 = ters kanat. Dusuk daha iyi."""
    label = slot["label"]
    detail = player.detail_position or ""
    if detail == label:
        return 0
    if label == "Merkez Orta Saha" and detail in _CENTRAL_MF:
        return 0
    p_side, s_side = _side(detail), _side(label)
    if p_side and s_side:
        return 1 if p_side == s_side else 3
    if not p_side and not s_side:
        return 1
    return 2  # biri kanat biri merkez oyuncusu


def build_default_assignment(players: list[Player], formation: Formation) -> dict[str, int | None]:
    """Slot key -> player_id eslemesi dondurur.

    Her slot icin once pozisyon uyum kademesine (tier), esitlikte piyasa
    degerine bakilir. Kanat etiketli orta saha slotlarina (orn. 4-4-2'de
    Sol Orta Saha) kanat forvetler de aday olur.
    """
    pool: dict[str, list[Player]] = {"GK": [], "DF": [], "MF": [], "FW": []}
    for p in players:
        pool.setdefault(p.position, pool["MF"]).append(p)

    used: set[int] = set()
    assignment: dict[str, int | None] = {}

    for slot in formation.position_slots:
        candidates: list[Player] = []
        for fallback in _FALLBACK_ROLES.get(slot["role"], [slot["role"]]):
            candidates = [c for c in pool.get(fallback, []) if c.id not in used]
            if candidates:
                break
        if slot["role"] == "MF" and _side(slot["label"]):
            wingers = [
                c
                for c in pool["FW"]
                if c.id not in used and "Kanat" in (c.detail_position or "")
            ]
            candidates = candidates + wingers

        if candidates:
            chosen = min(candidates, key=lambda c: (_match_tier(c, slot), -_value(c)))
            used.add(chosen.id)
            assignment[slot["key"]] = chosen.id
        else:
            assignment[slot["key"]] = None
    return assignment


def remap_assignment(
    current: dict[str, Player | None],
    old_formation: Formation,
    new_formation: Formation,
) -> dict[str, int | None]:
    """Formasyon degisiminde oyunculari yeni slotlara tasir.

    Once ayni slot key'leri korunur (orn. GK, LB), sonra kalan oyuncular rol
    uyumuna gore, en son kalanlar bos slotlara dagitilir.
    """
    old_roles = {s["key"]: s["role"] for s in old_formation.position_slots}
    new_slots = list(new_formation.position_slots)
    new_keys = {s["key"] for s in new_slots}

    assignment: dict[str, int | None] = {s["key"]: None for s in new_slots}
    leftovers: list[tuple[str, Player]] = []  # (eski rol, oyuncu)

    for key, player in current.items():
        if player is None:
            continue
        if key in new_keys and assignment[key] is None:
            assignment[key] = player.id
        else:
            leftovers.append((old_roles.get(key, player.position), player))

    def fill(match_role: bool) -> None:
        for slot in new_slots:
            if assignment[slot["key"]] is not None:
                continue
            for i, (role, player) in enumerate(leftovers):
                if match_role and role != slot["role"] and player.position != slot["role"]:
                    continue
                assignment[slot["key"]] = player.id
                leftovers.pop(i)
                break

    fill(match_role=True)
    fill(match_role=False)
    return assignment
