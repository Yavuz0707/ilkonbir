import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

const NAV = [
  { to: "/", label: "Ana Sayfa", end: true },
  { to: "/oyunlar", label: "Oyunlar", tone: "games" },
  { to: "/kulupler", label: "Kulüpler", tone: "clubs" },
  { to: "/dunya-kupasi", label: "Dünya Kupası", tone: "world" },
  { to: "/istatistikler", label: "İstatistikler", soon: true, tone: "stats" },
  { to: "/oyuncular", label: "Oyuncular", tone: "players" },
];

const TONES = {
  games: "#c084fc",
  clubs: "#ef4444",
  world: "#f6c85f",
  stats: "#facc15",
  players: "#d946ef",
};

function NavItem({ item, onClick }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      style={{ "--nav-tone": TONES[item.tone] || "var(--color-neon)" }}
      className={({ isActive }) =>
        `relative rounded-xl px-3 py-2 font-display text-sm font-bold uppercase tracking-wider transition ${
          isActive
            ? "bg-white/[0.035] text-[var(--nav-tone)] shadow-[0_0_18px_color-mix(in_srgb,var(--nav-tone)_18%,transparent)]"
            : "text-ink-muted hover:bg-white/[0.025] hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="flex items-center gap-1.5">
            {item.label}
            {item.soon && (
              <span className="rounded-md border border-mid/70 bg-deep/70 px-1.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-normal text-ink-faint">
                Yakında
              </span>
            )}
          </span>
          {isActive && (
            <motion.span
              layoutId="nav-underline"
              className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-[var(--nav-tone)]"
            />
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-night/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="brand-mark" aria-hidden="true" />
          <span className="font-display text-lg font-bold uppercase tracking-widest text-ink">
            İlk<span className="text-neon">Onbir</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </nav>

        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-deep/70 text-ink-muted transition hover:text-neon md:hidden"
          aria-label="Menüyü aç/kapat"
          aria-expanded={open}
        >
          <div className="flex flex-col gap-1">
            <span
              className={`h-0.5 w-4 bg-current transition ${open ? "translate-y-1.5 rotate-45" : ""}`}
            />
            <span className={`h-0.5 w-4 bg-current transition ${open ? "opacity-0" : ""}`} />
            <span
              className={`h-0.5 w-4 bg-current transition ${open ? "-translate-y-1.5 -rotate-45" : ""}`}
            />
          </div>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/10 bg-night/95 md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {NAV.map((item) => (
                <NavItem key={item.to} item={item} onClick={() => setOpen(false)} />
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
