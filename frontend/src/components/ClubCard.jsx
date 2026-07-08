import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { formatValue, hueFromName, initials } from "../utils/format";

/** Tek kulüp kartı. `value` verilirse (en değerli kulüpler) altına değer eklenir. */
export default function ClubCard({ club, value }) {
  const navigate = useNavigate();
  const hue = hueFromName(club.name);

  return (
    <motion.button
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        show: { opacity: 1, y: 0, scale: 1 },
      }}
      whileHover={{ y: -6 }}
      onClick={() => navigate(`/kulupler/${club.id}`)}
      className="bracket-corners group flex flex-col items-center gap-3 rounded-2xl border border-mid/50 bg-deep/40 p-5 backdrop-blur-sm transition-shadow duration-300 hover:border-mid hover:shadow-glow"
    >
      {club.logo_url ? (
        <img src={club.logo_url} alt="" className="h-16 w-16 object-contain" />
      ) : (
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full font-display text-xl font-bold text-ink ring-1 ring-mid"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 45% 24%), hsl(${hue} 55% 12%))` }}
        >
          {initials(club.name)}
        </span>
      )}
      <span className="text-center">
        <span className="block font-display font-bold uppercase tracking-wide text-ink transition group-hover:text-neon">
          {club.name}
        </span>
        <span className="mt-0.5 block text-xs text-ink-faint">{club.league}</span>
        {value != null ? (
          <span className="mt-1.5 block font-mono text-sm font-semibold text-gold">
            {formatValue(value)}
          </span>
        ) : (
          club.coach && <span className="mt-1 block text-[11px] text-ink-muted">{club.coach.name}</span>
        )}
      </span>
    </motion.button>
  );
}
