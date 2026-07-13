import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const GAMES = [
  {
    to: "/oyunlar/kim-daha-iyi",
    title: "Kim Daha İyi?",
    tagline: "Higher / Lower",
    icon: "VS",
    color: "#9b5cff",
    color2: "#ff8a3d",
  },
  {
    to: "/oyunlar/logo-bulmaca",
    title: "Logo Bulmaca",
    tagline: "10 Tur",
    icon: "LB",
    color: "#27d8ff",
    color2: "#f3d35f",
  },
  {
    to: "/oyunlar/kim-bu-siluet",
    title: "Kim Bu Silüet?",
    tagline: "Foto Tahmini",
    icon: "Sİ",
    color: "#d95cff",
    color2: "#27d8ff",
  },
  {
    to: "/oyunlar/ipucu-tahmin",
    title: "İpucu Tahmin",
    tagline: "3 İpucu",
    icon: "İP",
    color: "#31e6cf",
    color2: "#9b5cff",
  },
  {
    to: "/oyunlar/transfer-rotasi",
    title: "Transfer Rotası",
    tagline: "Kariyer İzi",
    icon: "TR",
    color: "#ff6b5f",
    color2: "#ffb454",
  },
  {
    to: "/oyunlar/turnuva",
    title: "Turnuva Oyunu",
    tagline: "Eleme Turu",
    icon: "KO",
    color: "#27d8ff",
    color2: "#9b5cff",
  },
];

export default function GamesPage() {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="theme-games page-shell pb-20 pt-8"
    >
      <header className="page-hero mb-8 px-5 py-8 text-center">
        <span className="motif-lines" aria-hidden="true" />
        <p className="eyebrow">İlk Onbir Arcade</p>
        <h1 className="mt-2 font-display text-5xl font-black uppercase tracking-wide text-ink sm:text-7xl">
          Oyun<span className="accent-text">lar</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
          Quiz, karşılaştırma ve turnuva modları için enerjik ama profesyonel bir oyun merkezi.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {GAMES.map((game, i) => (
          <motion.div
            key={game.to}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.34, delay: i * 0.06 }}
            whileHover={{ y: -6, scale: 1.015 }}
          >
            <Link
              to={game.to}
              style={{ "--game-color": game.color, "--game-color-2": game.color2 }}
              className="group relative flex min-h-56 flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-panel/65 p-5 shadow-lift backdrop-blur-xl transition hover:border-[var(--game-color)] hover:shadow-[0_0_34px_color-mix(in_srgb,var(--game-color)_18%,transparent)]"
            >
              <span
                className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[var(--game-color)] to-transparent opacity-75"
                aria-hidden="true"
              />
              <span
                className="absolute right-3 top-3 h-16 w-16 rounded-xl border border-[var(--game-color)]/30 opacity-15 transition group-hover:scale-125 group-hover:opacity-30"
                aria-hidden="true"
              />

              <div>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg font-display text-lg font-black text-night shadow-[0_0_20px_color-mix(in_srgb,var(--game-color)_22%,transparent)]"
                    style={{ background: `linear-gradient(135deg, ${game.color}, ${game.color2})` }}
                    aria-hidden="true"
                  >
                    {game.icon}
                  </span>
                  <p className="eyebrow text-right">{game.tagline}</p>
                </div>
                <h2 className="font-display text-2xl font-black uppercase leading-tight tracking-wide text-ink">
                  {game.title}
                </h2>
              </div>

              <span className="mt-8 inline-flex w-fit items-center gap-2 rounded-lg border border-[var(--game-color)]/55 bg-[var(--game-color)]/10 px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--game-color)] transition group-hover:bg-[var(--game-color)]/15">
                Oyna
                <span aria-hidden="true" className="transition group-hover:translate-x-1">
                  →
                </span>
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.main>
  );
}
