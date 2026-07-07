import { useMemo } from "react";
import { motion } from "framer-motion";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { formatValue, isStar, ROLE_COLORS } from "../utils/format";

const ROLE_ORDER = { GK: 0, DF: 1, MF: 2, FW: 3 };

/**
 * Sağ rail'deki yedek kadro. Sahada olmayan kulüp oyuncularını rol + değere
 * göre sıralar. Bir oyuncuya tıklanınca "yerleştirme modu" başlar (sahada
 * uygun pozisyonlar vurgulanır).
 */
export default function BenchList({ club, lineup, onPickPlayer, activePlayerId }) {
  const onPitchIds = useMemo(
    () => new Set((lineup?.slots || []).map((s) => s.player?.id).filter(Boolean)),
    [lineup]
  );

  const bench = useMemo(() => {
    const players = (club?.players || []).filter((p) => !onPitchIds.has(p.id));
    return [...players].sort(
      (a, b) =>
        (ROLE_ORDER[a.position] ?? 9) - (ROLE_ORDER[b.position] ?? 9) ||
        (b.market_value || 0) - (a.market_value || 0)
    );
  }, [club, onPitchIds]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="eyebrow">Yedek Kadro</p>
        <span className="font-mono text-xs text-ink-faint">{bench.length}</span>
      </div>

      {bench.length === 0 ? (
        <p className="rounded-lg border border-mid/40 bg-deep/40 px-3 py-4 text-center text-xs text-ink-muted">
          Tüm kadro sahada.
        </p>
      ) : (
        <ul className="thin-scroll -mr-1 max-h-[42vh] space-y-1 overflow-y-auto pr-1 lg:max-h-none lg:flex-1">
          {bench.map((p) => {
            const activePlace = p.id === activePlayerId;
            return (
              <motion.li key={p.id} layout>
                <button
                  onClick={() => onPickPlayer(p)}
                  className={`group flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition ${
                    activePlace
                      ? "border-neon bg-neon/10 shadow-glow-sm"
                      : "border-transparent hover:border-mid/60 hover:bg-mid/20"
                  }`}
                >
                  <PlayerAvatar player={p} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink group-hover:text-neon">
                      {p.name}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {p.detail_position || p.position}
                    </p>
                  </div>
                  <span
                    className={`rounded px-1 py-0.5 font-display text-[9px] font-bold ${ROLE_COLORS[p.position] || ""}`}
                  >
                    {p.position}
                  </span>
                  <span
                    className={`w-14 shrink-0 text-right font-mono text-xs font-medium ${
                      isStar(p) ? "text-gold" : "text-neon/90"
                    }`}
                  >
                    {formatValue(p.market_value)}
                  </span>
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
