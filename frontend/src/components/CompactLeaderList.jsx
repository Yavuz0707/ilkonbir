import { useState } from "react";
import { motion } from "framer-motion";
import { initials } from "../utils/format";

function RowImage({ image, round, fallback }) {
  const [broken, setBroken] = useState(false);
  const shape = round ? "rounded-full object-cover" : "rounded-md object-contain bg-night/40";
  if (image && !broken) {
    return (
      <img
        src={image}
        alt=""
        onError={() => setBroken(true)}
        className={`h-8 w-8 shrink-0 ring-1 ring-mid/60 ${shape}`}
      />
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-turf to-deep font-display text-[10px] font-bold text-ink-muted ring-1 ring-mid/60">
      {fallback ? initials(fallback) : "–"}
    </span>
  );
}

/**
 * Kompakt sıralı liderlik listesi (FM leaderboard tarzı).
 * `items`: [{ key, image, round, fallback, title, subtitle, value, valueClass, onClick }]
 */
export default function CompactLeaderList({ items, emptyText = "Veri yok." }) {
  if (!items || items.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-deep/45 px-3 py-8 text-center text-xs text-ink-muted">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-deep/40">
      {items.map((it, i) => {
        const Comp = it.onClick ? "button" : "div";
        return (
          <motion.li
            key={it.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
          >
            <Comp
              onClick={it.onClick}
              className={`flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition ${
                it.onClick ? "hover:bg-white/[0.035]" : ""
              }`}
            >
              <span className="w-4 shrink-0 text-center font-mono text-xs text-ink-faint">
                {i + 1}
              </span>
              <RowImage image={it.image} round={it.round} fallback={it.fallback} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{it.title}</span>
                {it.subtitle && (
                  <span className="block truncate text-[11px] text-ink-muted">{it.subtitle}</span>
                )}
              </span>
              <span
                className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
                  it.valueClass || "text-neon"
                }`}
              >
                {it.value}
              </span>
            </Comp>
          </motion.li>
        );
      })}
    </ul>
  );
}
