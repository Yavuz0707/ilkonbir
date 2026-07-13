import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { formatValue, hueFromName, initials } from "../utils/format";

export default function ClubCard({ club, value }) {
  const navigate = useNavigate();
  const hue = hueFromName(club.name);

  return (
    <motion.button
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        show: { opacity: 1, y: 0, scale: 1 },
      }}
      whileHover={{ y: -5 }}
      onClick={() => navigate(`/kulupler/${club.id}`)}
      className="bracket-corners card-hover group flex min-h-44 flex-col items-center gap-3 rounded-xl border border-white/10 bg-panel/45 p-5 backdrop-blur-sm"
    >
      {club.logo_url ? (
        <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-white/10 bg-void/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <img src={club.logo_url} alt="" className="h-full w-full object-contain" />
        </div>
      ) : (
        <span
          className="flex h-20 w-20 items-center justify-center rounded-xl font-display text-xl font-black text-ink ring-1 ring-white/10"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 45% 24%), hsl(${hue} 55% 12%))` }}
        >
          {initials(club.name)}
        </span>
      )}
      <span className="text-center">
        <span className="block font-display text-lg font-black uppercase tracking-wide text-ink transition group-hover:text-[color-mix(in_srgb,var(--accent)_78%,white)]">
          {club.name}
        </span>
        <span className="mt-0.5 block text-xs text-ink-faint">{club.league}</span>
        {value != null ? (
          <span className="mt-2 block font-mono text-sm font-semibold text-gold">
            {formatValue(value)}
          </span>
        ) : (
          club.coach && <span className="mt-1 block text-[11px] text-ink-muted">{club.coach.name}</span>
        )}
      </span>
    </motion.button>
  );
}
