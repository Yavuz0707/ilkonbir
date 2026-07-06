import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

const NAV = [
  { to: "/", label: "Ana Sayfa", end: true },
  { to: "/kulupler", label: "Kulüpler" },
  { to: "/dunya-kupasi", label: "Dünya Kupası", soon: true },
  { to: "/istatistikler", label: "İstatistikler", soon: true },
  { to: "/oyuncular", label: "Oyuncular", soon: true },
];

function NavItem({ item, onClick }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        `relative rounded-lg px-3 py-1.5 font-display text-sm font-bold uppercase tracking-wider transition ${
          isActive ? "text-neon" : "text-ink-muted hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="flex items-center gap-1.5">
            {item.label}
            {item.soon && (
              <span className="rounded bg-mid/60 px-1 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-normal text-ink-faint">
                Yakında
              </span>
            )}
          </span>
          {isActive && (
            <motion.span
              layoutId="nav-underline"
              className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-neon shadow-glow-sm"
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
    <header className="relative z-30 border-b border-mid/50 bg-night/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="text-xl">⚽</span>
          <span className="font-display text-lg font-bold uppercase tracking-widest text-ink">
            İlk<span className="text-neon">Onbir</span>
          </span>
        </Link>

        {/* Masaüstü menü */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </nav>

        {/* Mobil hamburger */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-mid/60 text-ink-muted transition hover:text-neon md:hidden"
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

      {/* Mobil açılır menü */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-mid/40 md:hidden"
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
