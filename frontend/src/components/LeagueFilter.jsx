export default function LeagueFilter({ leagues, value, onChange }) {
  if (leagues.length <= 1) return null;

  const chip = (active) =>
    `rounded-lg border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition ${
      active
        ? "segment-button-active"
        : "segment-button hover:border-[var(--accent-line)] hover:text-ink"
    }`;

  return (
    <div
      className="mx-auto flex w-fit max-w-full flex-wrap justify-center gap-2 rounded-xl border border-white/10 bg-void/35 p-1.5"
      role="radiogroup"
      aria-label="Lig filtresi"
    >
      {leagues.map((l) => (
        <button
          key={l}
          type="button"
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
