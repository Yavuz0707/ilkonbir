import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

const NAV = [
  { to: "/", label: "Ana Sayfa", end: true },
  { to: "/oyunlar", label: "Oyunlar", tone: "games" },
  { to: "/kulupler", label: "Kulüpler", tone: "clubs" },
  { to: "/dunya-kupasi", label: "Dünya Kupası", tone: "world" },
  { to: "/istatistikler", label: "İstatistikler", tone: "stats" },
  { to: "/oyuncular", label: "Oyuncular", tone: "players" },
];

const TONES = {
  home: "#27d8ff",
  games: "#9b5cff",
  clubs: "#e74f58",
  world: "#d6b45f",
  stats: "#31e6cf",
  players: "#2bd8ff",
};

const TONE_2 = {
  home: "#7c6dff",
  games: "#ff8a3d",
  clubs: "#aeb7c8",
  world: "#2f5c9c",
  stats: "#f3d35f",
  players: "#9b5cff",
};

function toneForPath(pathname) {
  if (pathname.startsWith("/oyunlar")) return "games";
  if (pathname.startsWith("/kulupler") || pathname.startsWith("/club/")) return "clubs";
  if (pathname.startsWith("/dunya-kupasi")) return "world";
  if (pathname.startsWith("/istatistikler")) return "stats";
  if (pathname.startsWith("/oyuncular")) return "players";
  return "home";
}

function NavItem({ item, onClick }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      style={{ "--nav-tone": TONES[item.tone] || "var(--color-neon)" }}
      className={({ isActive }) =>
        `relative rounded-lg px-3 py-2 font-sans text-sm font-bold uppercase tracking-[0.04em] transition ${
          isActive
            ? "bg-white/[0.045] text-[var(--nav-tone)] shadow-[0_0_18px_color-mix(in_srgb,var(--nav-tone)_16%,transparent)]"
            : "text-ink-muted hover:bg-white/[0.035] hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="flex items-center gap-1.5">
            {item.label}
            {item.soon && (
              <span className="rounded border border-white/10 bg-void/80 px-1.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-normal text-ink-faint">
                Yakında
              </span>
            )}
          </span>
          {isActive && (
            <motion.span
              layoutId="nav-underline"
              className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[var(--nav-tone)]"
            />
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const activeTone = toneForPath(location.pathname);

  return (
    <header
      className="glass-nav sticky top-0 z-40"
      style={{
        "--accent": TONES[activeTone],
        "--accent-2": TONE_2[activeTone],
        "--accent-soft": `color-mix(in srgb, ${TONES[activeTone]} 13%, transparent)`,
        "--accent-line": `color-mix(in srgb, ${TONES[activeTone]} 34%, transparent)`,
      }}
    >
      <div className="mx-auto flex max-w-[1366px] items-center justify-between px-4 py-3">
        <Link to="/" className="group flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-xi">XI</span>
          </span>
          <span className="leading-none">
            <span className="block font-display text-xl font-extrabold uppercase tracking-normal text-ink sm:text-2xl">
              İlk<span className="accent-text">Onbir</span>
            </span>
            <span className="mt-0.5 hidden font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-ink-faint sm:block">
              squad lab
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-void/75 text-ink-muted transition hover:border-[var(--accent-line)] hover:text-ink md:hidden"
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
