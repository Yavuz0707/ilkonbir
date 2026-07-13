import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import ClubGrid from "../components/ClubGrid.jsx";
import LeagueFilter from "../components/LeagueFilter.jsx";

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
      className="theme-clubs page-shell pb-20 pt-8"
    >
      <header className="page-hero mb-8 px-5 py-8 text-center">
        <span className="motif-lines" aria-hidden="true" />
        <p className="eyebrow">Kulüp Merkezi</p>
        <h1 className="mt-2 font-display text-5xl font-black uppercase tracking-wide text-ink sm:text-7xl">
          Kulüp<span className="accent-text">ler</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
          Ligleri tarayın, kulüp profillerine girin ve kadro değerlerini güçlü bir dashboard düzeninde inceleyin.
        </p>
      </header>

      <div className="mb-8 space-y-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kulüp ara..."
          aria-label="Kulüp ara"
          className="input-shell mx-auto block w-full max-w-md rounded-xl px-4 py-3 outline-none transition"
        />
        <LeagueFilter leagues={leagues} value={league} onChange={setLeague} />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton flex flex-col items-center gap-3 rounded-xl p-5">
              <span className="h-20 w-20 rounded-xl bg-mid/40" />
              <span className="h-4 w-24 rounded bg-mid/40" />
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <ClubGrid clubs={filtered} />
      ) : (
        <p className="app-panel py-12 text-center text-sm text-ink-muted">
          Bu aramaya uyan kulüp yok. Farklı bir isim ya da lig dene.
        </p>
      )}
    </motion.main>
  );
}
