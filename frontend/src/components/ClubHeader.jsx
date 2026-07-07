import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import TrophyList from "./TrophyList.jsx";
import { hueFromName, initials } from "../utils/format";

/**
 * Kulüp kimliği: ışık haleli logo, display fontla kulüp adı, altında
 * teknik direktör kartı. Fotoğraf yoksa kulüp adından türetilen tonda
 * bir monogram rozeti kullanılır.
 */
export default function ClubHeader({ club }) {
  const hue = hueFromName(club.name);
  const [coachOpen, setCoachOpen] = useState(false);

  return (
    <div>
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-widest text-ink-faint transition hover:text-neon"
      >
        ← Kulüpler
      </Link>

      <div className="flex items-center gap-4">
        {club.logo_url ? (
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-neon/10 blur-xl" aria-hidden="true" />
            <img
              src={club.logo_url}
              alt={club.name}
              className="relative h-16 w-16 object-contain"
            />
          </div>
        ) : (
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full font-display text-xl font-bold text-ink ring-1 ring-mid"
            style={{
              background: `linear-gradient(135deg, hsl(${hue} 45% 24%), hsl(${hue} 55% 12%))`,
            }}
          >
            {initials(club.name)}
          </div>
        )}
        <div>
          <h1 className="font-display text-xl font-bold uppercase leading-tight tracking-wide text-ink sm:text-2xl">
            {club.name}
          </h1>
          <p className="text-sm text-ink-muted">
            {club.league} • {club.country}
          </p>
        </div>
      </div>

      {club.coach && (
        <button
          type="button"
          onClick={() => setCoachOpen(true)}
          className="mt-4 flex w-full items-center gap-3 rounded-xl border border-mid/60 bg-deep/70 px-4 py-2.5 text-left backdrop-blur-sm transition hover:border-neon/60 hover:bg-mid/25"
        >
          {club.coach.photo_url ? (
            <img
              src={club.coach.photo_url}
              alt={club.coach.name}
              className="h-10 w-10 rounded-full object-cover ring-1 ring-mid"
            />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full font-display text-sm font-bold text-ink ring-1 ring-mid"
              style={{
                background: `linear-gradient(135deg, hsl(${hue} 40% 26%), hsl(${hue} 50% 14%))`,
              }}
            >
              {initials(club.coach.name)}
            </div>
          )}
          <div>
            <p className="eyebrow">Teknik Direktör</p>
            <p className="text-sm font-semibold text-ink">{club.coach.name}</p>
          </div>
        </button>
      )}

      <AnimatePresence>
        {coachOpen && club.coach && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-night/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
            onClick={() => setCoachOpen(false)}
          >
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Teknik direktör kupa vitrini"
              className="w-full max-w-md rounded-t-2xl border border-mid/70 bg-deep/95 p-4 shadow-lift backdrop-blur-xl sm:rounded-2xl"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Teknik Direktör Kupaları</p>
                  <h2 className="font-display text-xl font-bold uppercase tracking-wide text-ink">
                    {club.coach.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setCoachOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-mid/60 bg-night/60 text-ink-muted transition hover:text-neon"
                  aria-label="Kapat"
                >
                  x
                </button>
              </div>
              <TrophyList holderType="coach" holderId={club.coach.id} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
