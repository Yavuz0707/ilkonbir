import { useEffect, useState } from "react";
import { api } from "../api";

function placeLabel(place) {
  if (place === "Winner") return "Şampiyon";
  if (place === "Runner-up") return "Finalist";
  if (place === "3rd Place") return "3.";
  return place || "Derece";
}

export default function TrophyList({ holderType, holderId, compact = false }) {
  const [trophies, setTrophies] = useState([]);
  const [loading, setLoading] = useState(Boolean(holderId));
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!holderId) {
      setTrophies([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    setError(null);
    const loader =
      holderType === "coach" ? api.coachTrophies(holderId) : api.playerTrophies(holderId);
    loader
      .then((items) => {
        if (!cancelled) setTrophies(items);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [holderId, holderType]);

  if (loading) {
    return (
      <div className={compact ? "space-y-1.5" : "space-y-2"}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="skeleton block h-9 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-ember">Kupa verisi yüklenemedi: {error}</p>;
  }

  if (trophies.length === 0) {
    return <p className="text-xs text-ink-muted">Henüz senkronize edilmiş kupa verisi yok.</p>;
  }

  return (
    <ul className={`thin-scroll space-y-1.5 overflow-y-auto pr-1 ${compact ? "max-h-36" : "max-h-56"}`}>
      {trophies.map((trophy) => (
        <li
          key={trophy.id}
          className="rounded-lg border border-mid/50 bg-night/45 px-3 py-2"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-ink">{trophy.competition_name}</p>
            <span className="shrink-0 rounded border border-gold/40 px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wide text-gold">
              {placeLabel(trophy.place)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">
            {[trophy.season, trophy.club_name, trophy.country].filter(Boolean).join(" • ")}
          </p>
        </li>
      ))}
    </ul>
  );
}
