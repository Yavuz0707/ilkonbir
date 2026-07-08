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
      className="mx-auto max-w-6xl px-4 pb-20 pt-10"
    >
      <header className="mb-8 flex flex-col gap-4 text-center">
        <p className="eyebrow">Oyuncular</p>
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-ink sm:text-6xl">
          Oyuncu <span className="text-neon">Merkezi</span>
        </h1>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Oyuncu ara..."
            className="min-w-0 flex-1 rounded-xl border border-mid bg-deep/70 px-4 py-3 text-ink outline-none transition placeholder:text-ink-faint focus:border-neon focus:shadow-glow-sm"
          />
          <select
            value={position}
            onChange={(event) => setPosition(event.target.value)}
            className="rounded-xl border border-mid bg-deep/70 px-4 py-3 font-display text-sm font-bold uppercase text-ink outline-none transition focus:border-neon"
          >
            <option value="">Tum mevkiler</option>
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
        <p className="rounded-xl border border-ember/50 bg-deep/70 p-5 text-center text-ember">
          {error}
        </p>
      ) : (
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
                className="group flex h-full items-center gap-4 rounded-xl border border-mid/60 bg-deep/60 p-4 shadow-lift transition hover:-translate-y-1 hover:border-neon/55 hover:bg-deep/80"
              >
                <PlayerAvatar player={player} size="sm" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-lg font-bold uppercase tracking-wide text-ink group-hover:text-neon">
                    {player.name}
                  </h2>
                  <p className="mt-1 truncate text-sm text-ink-muted">
                    {player.club?.name || "Kulup yok"} - {ROLE_LABELS[player.position] || player.position}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold text-gold">
                  {formatValue(player.market_value)}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </motion.main>
  );
}
