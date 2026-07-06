import { Link } from "react-router-dom";
import { hueFromName, initials } from "../utils/format";

/**
 * Kulüp kimliği: ışık haleli logo, display fontla kulüp adı, altında
 * teknik direktör kartı. Fotoğraf yoksa kulüp adından türetilen tonda
 * bir monogram rozeti kullanılır.
 */
export default function ClubHeader({ club }) {
  const hue = hueFromName(club.name);

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
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-mid/60 bg-deep/70 px-4 py-2.5 backdrop-blur-sm">
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
        </div>
      )}
    </div>
  );
}
