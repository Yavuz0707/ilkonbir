import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api";
import ClubGrid from "../components/ClubGrid.jsx";
import CompactLeaderList from "../components/CompactLeaderList.jsx";
import StatLeaderPanel from "../components/StatLeaderPanel.jsx";
import { formatValue } from "../utils/format";

function TacticalPreview() {
  const dots = [
    [50, 84],
    [18, 64],
    [38, 69],
    [62, 69],
    [82, 64],
    [30, 45],
    [50, 51],
    [70, 45],
    [20, 25],
    [50, 18],
    [80, 25],
  ];

  return (
    <div className="relative mx-auto mt-8 w-full max-w-sm rounded-xl border border-white/10 bg-void/45 p-4 shadow-lift lg:mt-10">
      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow">4-3-3</span>
        <span className="rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--accent)_82%,white)]">
          Live XI
        </span>
      </div>
      <svg viewBox="0 0 100 120" className="h-72 w-full rounded-lg bg-[#0b241c]" aria-hidden="true">
        <defs>
          <linearGradient id="mini-grass" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#113525" />
            <stop offset="100%" stopColor="#071711" />
          </linearGradient>
          <pattern id="mini-stripes" width="100" height="18" patternUnits="userSpaceOnUse">
            <rect width="100" height="9" fill="rgba(255,255,255,0.035)" />
          </pattern>
        </defs>
        <rect width="100" height="120" fill="url(#mini-grass)" />
        <rect width="100" height="120" fill="url(#mini-stripes)" />
        <g fill="none" stroke="rgba(236,255,244,0.34)" strokeWidth="0.7">
          <rect x="7" y="7" width="86" height="106" rx="1.5" />
          <line x1="7" x2="93" y1="60" y2="60" />
          <circle cx="50" cy="60" r="12" />
          <rect x="25" y="7" width="50" height="19" />
          <rect x="25" y="94" width="50" height="19" />
        </g>
        <path
          d="M18 64 L38 69 L50 84 L62 69 L82 64 M30 45 L50 51 L70 45 M20 25 L50 18 L80 25"
          fill="none"
          stroke="var(--accent)"
          strokeDasharray="4 4"
          strokeWidth="1"
          opacity="0.45"
        />
        {dots.map(([x, y], index) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r={index === 9 ? 4.8 : 3.8} fill="#edf7ff" />
            <circle cx={x} cy={y} r={index === 9 ? 2.2 : 1.8} fill="var(--accent)" />
          </g>
        ))}
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["€1.2MR", "Kadro"],
          ["36", "Oyuncu"],
          ["Top 5", "Ligler"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-night/45 px-3 py-2">
            <p className="font-display text-sm font-bold text-ink">{value}</p>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [clubs, setClubs] = useState([]);
  const [valuableClubs, setValuableClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.clubs(), api.mostValuableClubs({ limit: 12 })])
      .then(([allClubs, mvc]) => {
        setClubs(allClubs);
        setValuableClubs(mvc);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredClubs = useMemo(
    () =>
      clubs.filter(
        (c) => !query || c.name.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr"))
      ),
    [clubs, query]
  );

  const clubItems = valuableClubs.map((r) => ({
    key: r.club.id,
    image: r.club.logo_url,
    round: false,
    fallback: r.club.name,
    title: r.club.name,
    subtitle: r.club.league,
    value: formatValue(r.total_market_value),
    valueClass: "text-gold",
    onClick: () => navigate(`/club/${r.club.id}`),
  }));

  const searching = query.trim().length > 0;

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="theme-home page-shell pb-20"
    >
      <header className="page-hero my-6 grid items-start gap-8 px-5 py-8 text-left lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
        <span className="motif-lines" aria-hidden="true" />
        <div>
          <p className="eyebrow">Premium Futbol Platformu</p>
          <motion.h1
            initial={{ y: -14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="mt-2 font-display text-4xl font-extrabold uppercase tracking-normal text-ink sm:text-6xl"
          >
            İlk <span className="accent-text">Onbir</span>
          </motion.h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-muted sm:text-base">
            Takımını seç, gerçek kadrosuyla sahaya çık. Piyasa değerleri, gol ve asist
            krallığı, oyunlar ve turnuva ekranları tek modern futbol panelinde.
          </p>
          <div className="mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              ["Canlı", "Kadro değeri"],
              ["11", "Saha dizilimi"],
              ["360°", "Kulüp profili"],
            ].map(([value, label]) => (
              <div key={label} className="metric-tile px-4 py-3">
                <p className="font-display text-xl font-bold uppercase text-ink">{value}</p>
                <p className="eyebrow mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <TacticalPreview />
      </header>

      <div className="mb-10">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kulüp ara..."
          aria-label="Kulüp ara"
          className="input-shell mx-auto block w-full max-w-md rounded-xl px-4 py-3 outline-none transition"
        />
      </div>

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-72 rounded-xl" />
          ))}
        </div>
      ) : searching ? (
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-bold uppercase tracking-normal text-ink">
              Kulüp Sonuçları
            </h2>
            <span className="font-mono text-xs text-ink-faint">{filteredClubs.length} kulüp</span>
          </div>
          {filteredClubs.length > 0 ? (
            <ClubGrid clubs={filteredClubs} />
          ) : (
            <p className="app-panel py-12 text-center text-sm text-ink-muted">
              Bu aramaya uyan kulüp yok, farklı bir isim dene.
            </p>
          )}
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="flex flex-col">
            <h2 className="mb-3 font-display text-xl font-bold uppercase tracking-normal text-ink">
              En Değerli Kulüpler
            </h2>
            <div className="mb-3 h-[26px]" aria-hidden="true" />
            <CompactLeaderList items={clubItems} />
          </section>

          <StatLeaderPanel title="Gol Krallığı" metric="goals" />
          <StatLeaderPanel title="Asist Krallığı" metric="assists" />
        </div>
      )}
    </motion.main>
  );
}
