import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api";
import ClubGrid from "../components/ClubGrid.jsx";
import CompactLeaderList from "../components/CompactLeaderList.jsx";
import StatLeaderPanel from "../components/StatLeaderPanel.jsx";
import { formatValue } from "../utils/format";

/** Hero arka planı: yarı saydam 4-3-3 taktik diyagramı. */
function FormationDiagram() {
  const dots = [
    [50, 86], [16, 66], [38, 70], [62, 70], [84, 66],
    [30, 46], [50, 52], [70, 46], [18, 24], [50, 16], [82, 24],
  ];
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute left-1/2 top-0 h-full w-auto -translate-x-1/2 opacity-[0.16]"
      aria-hidden="true"
    >
      <g stroke="#6bffa0" strokeWidth="0.35" strokeDasharray="2 2" fill="none">
        <path d="M 16 66 L 38 70 L 62 70 L 84 66" />
        <path d="M 30 46 L 50 52 L 70 46" />
        <path d="M 18 24 L 50 16 L 82 24" />
        <path d="M 50 86 L 50 52" />
      </g>
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.8" fill="#6bffa0" />
      ))}
    </svg>
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
      className="mx-auto max-w-6xl px-4 pb-20"
    >
      {/* Hero */}
      <header className="relative overflow-hidden pb-8 pt-12 text-center sm:pt-16">
        <FormationDiagram />
        <p className="eyebrow relative">Taktik Tahtası</p>
        <motion.h1
          initial={{ y: -14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="relative mt-2 font-display text-4xl font-bold uppercase tracking-wide text-ink sm:text-6xl"
        >
          İlk{" "}
          <span className="text-neon" style={{ textShadow: "0 0 22px rgba(107,255,160,0.45)" }}>
            Onbir
          </span>
        </motion.h1>
        <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
          Takımını seç, gerçek kadrosuyla sahaya çık. Piyasa değerleri, gol ve asist
          krallığı — hepsi güncel.
        </p>
      </header>

      {/* Arama (lig chip'leri kaldırıldı — lig seçimi gol/asist panellerinde) */}
      <div className="mb-10">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kulüp ara..."
          aria-label="Kulüp ara"
          className="mx-auto block w-full max-w-md rounded-xl border border-mid bg-deep/70 px-4 py-2.5 text-ink placeholder-ink-faint outline-none backdrop-blur transition focus:border-neon focus:shadow-glow-sm"
        />
      </div>

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-72 rounded-xl" />
          ))}
        </div>
      ) : searching ? (
        /* Arama modu: tam kulüp listesi */
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-bold uppercase tracking-wide text-ink">
              Kulüp Sonuçları
            </h2>
            <span className="text-xs text-ink-faint">{filteredClubs.length} kulüp</span>
          </div>
          {filteredClubs.length > 0 ? (
            <ClubGrid clubs={filteredClubs} />
          ) : (
            <p className="py-12 text-center text-sm text-ink-muted">
              Bu aramaya uyan kulüp yok — farklı bir isim dene.
            </p>
          )}
        </section>
      ) : (
        /* Öne çıkanlar: 3 sütun kompakt liste (mobilde dikey stack) */
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="flex flex-col">
            <h2 className="mb-3 font-display text-lg font-bold uppercase tracking-wide text-ink">
              En Değerli Kulüpler
            </h2>
            {/* selektörlerle hizalı dursun diye başlık altında boşluk */}
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
