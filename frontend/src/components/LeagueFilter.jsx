/** Lig filtre chip'leri (yalnizca lig adlari; "Tümü" yok, her zaman bir lig secili). */
export default function LeagueFilter({ leagues, value, onChange }) {
  if (leagues.length <= 1) return null;
  const chip = (active) =>
    `rounded-full px-4 py-1.5 font-display text-sm font-bold tracking-wide transition ${
      active
        ? "bg-neon text-night shadow-glow-sm"
        : "border border-mid/70 bg-deep/50 text-ink-muted hover:text-ink"
    }`;

  return (
    <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Lig filtresi">
      {leagues.map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={value === l}
          onClick={() => onChange(l)}
          className={chip(value === l)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
