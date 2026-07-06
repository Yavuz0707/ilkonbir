import { motion } from "framer-motion";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { formatValue, isStar, ROLE_COLORS } from "../utils/format";

/** Modal içindeki oyuncu listesi (yedekler ya da arama sonuçları). */
export default function PlayerSearchResults({ players, onSelect, emptyText, showClub = false }) {
  if (players.length === 0) {
    return <p className="px-6 py-10 text-center text-sm text-ink-muted">{emptyText}</p>;
  }

  return (
    <motion.ul
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.03 } } }}
      className="divide-y divide-mid/40"
    >
      {players.map((p) => (
        <motion.li
          key={p.id}
          variants={{
            hidden: { opacity: 0, y: 8 },
            show: { opacity: 1, y: 0 },
          }}
        >
          <button
            onClick={() => onSelect(p)}
            className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-mid/25"
          >
            <PlayerAvatar player={p} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink group-hover:text-neon">
                {p.name}
                {p.jersey_number != null && (
                  <span className="ml-1.5 font-mono text-xs font-normal text-ink-faint">
                    #{p.jersey_number}
                  </span>
                )}
              </p>
              <p className="flex items-center gap-1.5 truncate text-xs text-ink-muted">
                {showClub && p.club ? (
                  <>
                    {p.club.logo_url && (
                      <img src={p.club.logo_url} alt="" className="h-3.5 w-3.5 object-contain" />
                    )}
                    <span className="truncate">{p.club.name}</span>
                    <span className="text-ink-faint">•</span>
                  </>
                ) : null}
                <span>{p.detail_position || p.position}</span>
              </p>
            </div>
            <span
              className={`rounded px-1.5 py-0.5 font-display text-[10px] font-bold ${ROLE_COLORS[p.position] || ""}`}
            >
              {p.position}
            </span>
            <span
              className={`w-18 text-right font-mono text-sm font-medium ${
                isStar(p) ? "text-gold" : "text-neon/90"
              }`}
            >
              {formatValue(p.market_value)}
            </span>
          </button>
        </motion.li>
      ))}
    </motion.ul>
  );
}
