import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import ClubGrid from "../components/ClubGrid.jsx";
import LeagueFilter from "../components/LeagueFilter.jsx";

/** "Kulüpler" sayfası: tam kulüp listesi, arama + lig filtresi. */
export default function ClubsPage() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState(null);

  useEffect(() => {
    api
      .clubs()
      .then((data) => {
        setClubs(data);
        // Varsayilan lig: Premier League (yoksa alfabetik ilk lig).
        const available = [...new Set(data.map((c) => c.league).filter(Boolean))];
        setLeague(available.includes("Premier League") ? "Premier League" : available[0] ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const leagues = useMemo(
    () => [...new Set(clubs.map((c) => c.league).filter(Boolean))],
    [clubs]
  );
  const filtered = useMemo(
    () =>
      clubs.filter(
        (c) =>
          (!league || c.league === league) &&
          (!query || c.name.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")))
      ),
    [clubs, query, league]
  );

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-6xl px-4 pb-20 pt-10"
    >
      <h1 className="mb-6 text-center font-display text-3xl font-bold uppercase tracking-wide text-ink">
        Kulüpler
      </h1>
      <div className="mb-8 space-y-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kulüp ara..."
          aria-label="Kulüp ara"
          className="mx-auto block w-full max-w-md rounded-xl border border-mid bg-deep/70 px-4 py-2.5 text-ink placeholder-ink-faint outline-none backdrop-blur transition focus:border-neon focus:shadow-glow-sm"
        />
        <LeagueFilter leagues={leagues} value={league} onChange={setLeague} />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton flex flex-col items-center gap-3 rounded-2xl p-5">
              <span className="h-16 w-16 rounded-full bg-mid/40" />
              <span className="h-4 w-24 rounded bg-mid/40" />
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <ClubGrid clubs={filtered} />
      ) : (
        <p className="py-12 text-center text-sm text-ink-muted">
          Bu aramaya uyan kulüp yok — farklı bir isim ya da lig dene.
        </p>
      )}
    </motion.main>
  );
}
