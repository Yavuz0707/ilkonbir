import { AnimatePresence, motion } from "framer-motion";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { formatValue, isStar, pitchName } from "../utils/format";

/**
 * Saha üzerindeki tek oyuncu kartı. Formasyon değişiminde `layout` ile yeni
 * konumuna kayar; oyuncu değişiminde kısa bir ışık patlamasıyla yenilenir.
 * Pozisyon bilgisi hover tooltip'inde; yıldız oyuncular altın vurgu alır.
 */
export default function PlayerSlot({
  slot,
  position,
  onClick,
  isSelected,
  highlight = false,
  dimmed = false,
}) {
  const player = slot.player;
  const star = isStar(player);

  return (
    <motion.button
      layout
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      onClick={onClick}
      animate={{ opacity: dimmed ? 0.4 : 1 }}
      className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer focus:outline-none"
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      whileHover={{ scale: 1.06, y: -2 }}
      whileTap={{ scale: 0.96 }}
      aria-label={
        player
          ? `${position.label}: ${player.name}, ${formatValue(player.market_value)}`
          : `${position.label}: boş`
      }
    >
      {/* Pozisyon tooltip'i */}
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded border border-mid/70 bg-night/95 px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-widest text-ink-muted opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        {player?.detail_position || position.label}
      </span>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={player ? player.id : "empty"}
          initial={{ opacity: 0, scale: 1.35, filter: "brightness(3)" }}
          animate={{ opacity: 1, scale: 1, filter: "brightness(1)" }}
          exit={{ opacity: 0, scale: 0.7, filter: "brightness(0.6)" }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <div
            className={`relative rounded-full transition-shadow duration-300 ${
              isSelected || highlight
                ? "glow-pulse ring-2 ring-neon"
                : star
                  ? "ring-2 ring-gold/70 group-hover:shadow-[0_0_22px_rgba(242,193,78,0.35)]"
                  : "ring-1 ring-transparent group-hover:shadow-glow"
            }`}
          >
            {player ? (
              <PlayerAvatar player={player} size="md" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-moss/50 bg-deep/70 text-2xl text-moss">
                +
              </div>
            )}
            {player?.jersey_number != null && (
              <span
                className={`absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-night px-0.5 font-mono text-[10px] font-semibold ring-1 ${
                  star ? "text-gold ring-gold/60" : "text-neon ring-mid"
                }`}
              >
                {player.jersey_number}
              </span>
            )}
          </div>

          <div className="mt-1.5 max-w-32 rounded-md bg-night/85 px-1.5 py-0.5 text-center backdrop-blur-sm ring-1 ring-mid/60">
            <p className="truncate text-[11px] font-semibold leading-tight text-ink">
              {player ? pitchName(player) : position.label}
            </p>
            <p
              className={`font-mono text-[10px] font-medium leading-tight ${
                star ? "text-gold" : "text-neon/90"
              }`}
            >
              {player ? formatValue(player.market_value) : "Boş"}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}
