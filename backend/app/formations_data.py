"""Formasyon sablonlari.

Koordinatlar dikey saha uzerinde yuzde cinsindendir: x=0 sol cizgi, x=100 sag cizgi,
y=0 rakip kale (hucum), y=100 kendi kalemiz. Frontend bu degerleri dogrudan
`left`/`top` yuzdesi olarak kullanir.
"""

FORMATIONS: list[dict] = [
    {
        "name": "4-3-3",
        "position_slots": [
            {"key": "GK", "label": "Kaleci", "role": "GK", "x": 50, "y": 88},
            {"key": "LB", "label": "Sol Bek", "role": "DF", "x": 14, "y": 68},
            {"key": "LCB", "label": "Stoper", "role": "DF", "x": 37, "y": 73},
            {"key": "RCB", "label": "Stoper", "role": "DF", "x": 63, "y": 73},
            {"key": "RB", "label": "Sağ Bek", "role": "DF", "x": 86, "y": 68},
            {"key": "LCM", "label": "Merkez Orta Saha", "role": "MF", "x": 27, "y": 47},
            {"key": "CM", "label": "Merkez Orta Saha", "role": "MF", "x": 50, "y": 54},
            {"key": "RCM", "label": "Merkez Orta Saha", "role": "MF", "x": 73, "y": 47},
            {"key": "LW", "label": "Sol Kanat", "role": "FW", "x": 16, "y": 24},
            {"key": "ST", "label": "Santrfor", "role": "FW", "x": 50, "y": 17},
            {"key": "RW", "label": "Sağ Kanat", "role": "FW", "x": 84, "y": 24},
        ],
    },
    {
        "name": "4-4-2",
        "position_slots": [
            {"key": "GK", "label": "Kaleci", "role": "GK", "x": 50, "y": 88},
            {"key": "LB", "label": "Sol Bek", "role": "DF", "x": 14, "y": 68},
            {"key": "LCB", "label": "Stoper", "role": "DF", "x": 37, "y": 73},
            {"key": "RCB", "label": "Stoper", "role": "DF", "x": 63, "y": 73},
            {"key": "RB", "label": "Sağ Bek", "role": "DF", "x": 86, "y": 68},
            {"key": "LM", "label": "Sol Orta Saha", "role": "MF", "x": 13, "y": 44},
            {"key": "LCM", "label": "Merkez Orta Saha", "role": "MF", "x": 38, "y": 49},
            {"key": "RCM", "label": "Merkez Orta Saha", "role": "MF", "x": 62, "y": 49},
            {"key": "RM", "label": "Sağ Orta Saha", "role": "MF", "x": 87, "y": 44},
            {"key": "LS", "label": "Santrfor", "role": "FW", "x": 38, "y": 20},
            {"key": "RS", "label": "Santrfor", "role": "FW", "x": 62, "y": 20},
        ],
    },
    {
        "name": "4-2-3-1",
        "position_slots": [
            {"key": "GK", "label": "Kaleci", "role": "GK", "x": 50, "y": 88},
            {"key": "LB", "label": "Sol Bek", "role": "DF", "x": 14, "y": 68},
            {"key": "LCB", "label": "Stoper", "role": "DF", "x": 37, "y": 73},
            {"key": "RCB", "label": "Stoper", "role": "DF", "x": 63, "y": 73},
            {"key": "RB", "label": "Sağ Bek", "role": "DF", "x": 86, "y": 68},
            {"key": "LDM", "label": "Ön Libero", "role": "MF", "x": 37, "y": 55},
            {"key": "RDM", "label": "Ön Libero", "role": "MF", "x": 63, "y": 55},
            {"key": "LAM", "label": "Sol Kanat", "role": "MF", "x": 17, "y": 35},
            {"key": "CAM", "label": "On Numara", "role": "MF", "x": 50, "y": 33},
            {"key": "RAM", "label": "Sağ Kanat", "role": "MF", "x": 83, "y": 35},
            {"key": "ST", "label": "Santrfor", "role": "FW", "x": 50, "y": 16},
        ],
    },
    {
        "name": "3-5-2",
        "position_slots": [
            {"key": "GK", "label": "Kaleci", "role": "GK", "x": 50, "y": 88},
            {"key": "LCB", "label": "Stoper", "role": "DF", "x": 26, "y": 71},
            {"key": "CB", "label": "Stoper", "role": "DF", "x": 50, "y": 74},
            {"key": "RCB", "label": "Stoper", "role": "DF", "x": 74, "y": 71},
            {"key": "LWB", "label": "Sol Kanat Bek", "role": "DF", "x": 8, "y": 47},
            {"key": "LCM", "label": "Merkez Orta Saha", "role": "MF", "x": 30, "y": 49},
            {"key": "CM", "label": "Ön Libero", "role": "MF", "x": 50, "y": 56},
            {"key": "RCM", "label": "Merkez Orta Saha", "role": "MF", "x": 70, "y": 49},
            {"key": "RWB", "label": "Sağ Kanat Bek", "role": "DF", "x": 92, "y": 47},
            {"key": "LS", "label": "Santrfor", "role": "FW", "x": 38, "y": 19},
            {"key": "RS", "label": "Santrfor", "role": "FW", "x": 62, "y": 19},
        ],
    },
    {
        "name": "3-4-3",
        "position_slots": [
            {"key": "GK", "label": "Kaleci", "role": "GK", "x": 50, "y": 88},
            {"key": "LCB", "label": "Stoper", "role": "DF", "x": 26, "y": 71},
            {"key": "CB", "label": "Stoper", "role": "DF", "x": 50, "y": 74},
            {"key": "RCB", "label": "Stoper", "role": "DF", "x": 74, "y": 71},
            {"key": "LM", "label": "Sol Orta Saha", "role": "MF", "x": 13, "y": 48},
            {"key": "LCM", "label": "Merkez Orta Saha", "role": "MF", "x": 38, "y": 52},
            {"key": "RCM", "label": "Merkez Orta Saha", "role": "MF", "x": 62, "y": 52},
            {"key": "RM", "label": "Sağ Orta Saha", "role": "MF", "x": 87, "y": 48},
            {"key": "LW", "label": "Sol Kanat", "role": "FW", "x": 20, "y": 24},
            {"key": "ST", "label": "Santrfor", "role": "FW", "x": 50, "y": 17},
            {"key": "RW", "label": "Sağ Kanat", "role": "FW", "x": 80, "y": 24},
        ],
    },
]

DEFAULT_FORMATION = "4-3-3"
