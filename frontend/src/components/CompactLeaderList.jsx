import { useState } from "react";
import { motion } from "framer-motion";
import { initials } from "../utils/format";

function RowImage({ image, round, fallback }) {
  const [broken, setBroken] = useState(false);
  const shape = round ? "rounded-full object-cover" : "rounded-lg object-contain bg-void/55 p-1";

  if (image && !broken) {
    return (
      <img
        src={image}
        alt=""
        onError={() => setBroken(true)}
        className={`h-9 w-9 shrink-0 ring-1 ring-white/10 ${shape}`}
      />
    );
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-panel-2 to-void font-display text-[10px] font-black text-ink-muted ring-1 ring-white/10">
      {fallback ? initials(fallback) : "-"}
    </span>
  );
}

export default function CompactLeaderList({ items, emptyText = "Veri yok." }) {
  if (!items || items.length === 0) {
    return (
      <p className="leaderboard-shell px-3 py-8 text-center text-xs text-ink-muted">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="leaderboard-shell divide-y divide-white/10">
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
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                it.onClick ? "hover:bg-white/[0.045]" : ""
              }`}
            >
              <span className="w-5 shrink-0 text-center font-mono text-xs font-semibold text-ink-faint">
                {String(i + 1).padStart(2, "0")}
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
