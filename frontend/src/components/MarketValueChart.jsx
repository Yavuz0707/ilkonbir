import { formatValue } from "../utils/format";

function cleanPoints(points = []) {
  return points
    .filter((point) => point && point.market_value != null)
    .map((point) => ({
      ...point,
      value: Number(point.market_value),
    }))
    .filter((point) => Number.isFinite(point.value))
    .slice(-12);
}

export default function MarketValueChart({ points = [], title = "Piyasa Degeri" }) {
  const data = cleanPoints(points);

  if (data.length < 2) {
    return (
      <section className="rounded-xl border border-mid/60 bg-deep/65 p-5 shadow-lift">
        <p className="eyebrow">{title}</p>
        <p className="mt-4 text-sm text-ink-muted">Trend verisi henuz yok.</p>
      </section>
    );
  }

  const width = 640;
  const height = 220;
  const padX = 28;
  const padY = 24;
  const min = Math.min(...data.map((point) => point.value));
  const max = Math.max(...data.map((point) => point.value));
  const spread = Math.max(max - min, 1);
  const coords = data.map((point, index) => {
    const x = padX + (index / (data.length - 1)) * (width - padX * 2);
    const y = height - padY - ((point.value - min) / spread) * (height - padY * 2);
    return { ...point, x, y };
  });
  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const fill = `${path} L ${coords[coords.length - 1].x} ${height - padY} L ${coords[0].x} ${height - padY} Z`;

  return (
    <section className="rounded-xl border border-mid/60 bg-deep/65 p-5 shadow-lift">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{title}</p>
          <h2 className="mt-1 font-display text-2xl font-bold uppercase text-ink">
            {formatValue(coords[coords.length - 1].value)}
          </h2>
        </div>
        <span className="font-mono text-xs text-ink-faint">
          {coords[0].date} - {coords[coords.length - 1].date}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full overflow-visible">
        <defs>
          <linearGradient id="market-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-neon)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-neon)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fill} fill="url(#market-chart-fill)" />
        <path d={path} fill="none" stroke="var(--color-neon)" strokeWidth="4" strokeLinecap="round" />
        {coords.map((point) => (
          <g key={`${point.date}-${point.value}`}>
            <circle cx={point.x} cy={point.y} r="5" fill="var(--color-night)" stroke="var(--color-neon)" strokeWidth="3" />
            <title>{`${point.date}: ${formatValue(point.value)}`}</title>
          </g>
        ))}
      </svg>
    </section>
  );
}
