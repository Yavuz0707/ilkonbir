import { useState } from "react";
import { initials } from "../utils/format";

/** Oyuncu fotoğrafı; yoksa/yüklenemezse baş harflerden monogram üretir. */
export default function PlayerAvatar({ player, size = "md" }) {
  const [broken, setBroken] = useState(false);
  const sizes = {
    sm: "h-9 w-9 text-xs",
    md: "h-14 w-14 text-base",
    lg: "h-20 w-20 text-xl",
  };

  if (player.photo_url && !broken) {
    return (
      <img
        src={player.photo_url}
        alt={player.name}
        onError={() => setBroken(true)}
        className={`${sizes[size]} rounded-full bg-deep object-cover ring-2 ring-turf`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} flex items-center justify-center rounded-full bg-gradient-to-br from-turf to-deep font-display font-bold text-ink-muted ring-2 ring-turf`}
    >
      {initials(player.name)}
    </div>
  );
}
