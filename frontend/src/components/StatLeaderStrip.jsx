import { useState } from "react";
import { motion } from "framer-motion";
import { initials } from "../utils/format";

function StatAvatar({ row }) {
  const [broken, setBroken] = useState(false);
  if (row.photo_url && !broken) {
    return (
      <img
        src={row.photo_url}
        alt=""
        onError={() => setBroken(true)}
        className="h-16 w-16 rounded-full object-cover ring-2 ring-turf"
      />
    );
  }
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-turf to-deep font-display font-bold text-ink-muted ring-2 ring-turf">
      {initials(row.name)}
    </div>
  );
}

/**
 * Yatay kaydırılabilir lider şeridi (gol/asist krallığı).
 * `metric`: "goals" | "assists" — büyük vurgulu rakam.
 */
export default function StatLeaderStrip({ rows, metric }) {
  if (!rows || rows.length === 0) {
    return (
      <p className="rounded-xl border border-mid/40 bg-deep/40 px-4 py-8 text-center text-sm text-ink-muted">
        Bu lig için istatistik verisi henüz yok.
      </p>
    );
  }

  return (
    <div className="thin-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {rows.map((row, i) => (
        <motion.div
          key={`${row.external_player_id}-${metric}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.04, 0.4) }}
          className="relative flex w-36 shrink-0 flex-col items-center gap-2 rounded-2xl border border-mid/50 bg-deep/40 p-4 backdrop-blur-sm"
        >
          <span className="absolute left-2 top-2 font-display text-xs font-bold text-ink-faint">
            {i + 1}
          </span>
          <div className="relative">
            <StatAvatar row={row} />
            {row.club_logo && (
              <img
                src={row.club_logo}
                alt=""
                className="absolute -right-1 -bottom-1 h-6 w-6 rounded-full bg-night object-contain p-0.5 ring-1 ring-mid"
              />
            )}
          </div>
          <p className="line-clamp-1 w-full text-center text-sm font-semibold text-ink" title={row.name}>
            {row.name}
          </p>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-3xl font-semibold text-neon tabular-nums">
              {row[metric]}
            </span>
            <span className="eyebrow">{metric === "goals" ? "gol" : "asist"}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
