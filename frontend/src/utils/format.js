/** EUR piyasa değerini kısa biçimde yazar: €75M, €1,23Mr, €850K */
export function formatValue(value) {
  if (value == null) return "—";
  if (value >= 1_000_000_000) {
    return `€${(value / 1_000_000_000).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}Mr`;
  }
  if (value >= 1_000_000) {
    return `€${(value / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}M`;
  }
  if (value >= 1_000) return `€${Math.round(value / 1_000)}K`;
  return `€${value}`;
}

/** Yıldız oyuncu eşiği — altın vurgu yalnızca bunlarda kullanılır. */
export const STAR_THRESHOLD = 80_000_000;

export function isStar(player) {
  return (player?.market_value || 0) >= STAR_THRESHOLD;
}

/**
 * Saha üstü isim: normal oyuncularda kısaltılmış soyad ("V. Osimhen"),
 * yıldız oyuncularda tam isim.
 */
export function pitchName(player) {
  if (!player) return "";
  if (isStar(player)) return player.name;
  const parts = player.name.split(" ").filter(Boolean);
  if (parts.length < 2 || player.name.length <= 14) return player.name;
  const last = parts[parts.length - 1];
  return `${parts[0][0]}. ${last}`;
}

export function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/** Kulüp adından deterministik bir ton üretir (monogram rozetleri için). */
export function hueFromName(name = "") {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)) % 360;
  return hash;
}

export const ROLE_LABELS = { GK: "Kaleci", DF: "Defans", MF: "Orta Saha", FW: "Forvet" };

export const ROLE_COLORS = {
  GK: "bg-amber-400/90 text-amber-950",
  DF: "bg-sky-400/90 text-sky-950",
  MF: "bg-moss/90 text-night",
  FW: "bg-rose-400/90 text-rose-950",
};
