import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api";
import PlayerAvatar from "../components/PlayerAvatar.jsx";
import { formatValue, ROLE_LABELS } from "../utils/format";

export default function PlayersPage() {
  const [players, setPlayers] = useState([]);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const params = useMemo(
    () => ({ q: query.length >= 2 ? query : "", position, limit: 48 }),
    [position, query]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .searchPlayers(params)
      .then((data) => {
        if (!cancelled) setPlayers(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="theme-players page-shell pb-20 pt-8"
    >
      <header className="page-hero mb-8 px-5 py-8 text-center">
        <span className="motif-lines" aria-hidden="true" />
        <p className="eyebrow">Oyuncular</p>
        <h1 className="mt-2 font-display text-5xl font-black uppercase tracking-wide text-ink sm:text-7xl">
          Oyuncu <span className="accent-text">Merkezi</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
          Yıldız oyuncuları arayın, pozisyona göre süzün ve değer trendlerine hızlıca ulaşın.
        </p>
        <div className="mx-auto mt-6 flex w-full max-w-2xl flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Oyuncu ara..."
            className="input-shell min-w-0 flex-1 rounded-xl px-4 py-3 outline-none transition"
          />
          <select
            value={position}
            onChange={(event) => setPosition(event.target.value)}
            className="input-shell rounded-xl px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.1em] outline-none transition"
          >
            <option value="">Tüm mevkiler</option>
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="app-panel border-ember/50 p-5 text-center text-ember">{error}</p>
      ) : players.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.02 }}
            >
              <Link
                to={`/oyuncular/${player.id}`}
                className="card-hover group flex h-full items-center gap-4 rounded-xl border border-white/10 bg-panel/50 p-4 shadow-lift"
              >
                <PlayerAvatar player={player} size="sm" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-lg font-black uppercase tracking-wide text-ink group-hover:text-[color-mix(in_srgb,var(--accent)_76%,white)]">
                    {player.name}
                  </h2>
                  <p className="mt-1 truncate text-sm text-ink-muted">
                    {player.club?.name || "Kulüp yok"} - {ROLE_LABELS[player.position] || player.position}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg border border-white/10 bg-void/55 px-2.5 py-1 font-mono text-sm font-semibold text-gold">
                  {formatValue(player.market_value)}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="app-panel py-12 text-center text-sm text-ink-muted">
          Bu filtrelerle oyuncu bulunamadı.
        </p>
      )}
    </motion.main>
  );
}
