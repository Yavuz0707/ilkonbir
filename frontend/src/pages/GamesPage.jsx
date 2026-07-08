import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const GAMES = [
  {
    to: "/oyunlar/kim-daha-iyi",
    title: "Kim Daha İyi?",
    tagline: "Higher / Lower",
    icon: "VS",
    color: "#6bffa0",
    glow: "rgba(107,255,160,0.22)",
  },
  {
    to: "/oyunlar/logo-bulmaca",
    title: "Logo Bulmaca",
    tagline: "10 Tur",
    icon: "LB",
    color: "#7dd3fc",
    glow: "rgba(125,211,252,0.2)",
  },
  {
    to: "/oyunlar/kim-bu-siluet",
    title: "Kim Bu Silüet?",
    tagline: "Foto Tahmini",
    icon: "Sİ",
    color: "#f2c14e",
    glow: "rgba(242,193,78,0.22)",
  },
  {
    to: "/oyunlar/ipucu-tahmin",
    title: "İpucu Tahmin",
    tagline: "3 İpucu",
    icon: "İP",
    color: "#6ee7b7",
    glow: "rgba(110,231,183,0.2)",
  },
  {
    to: "/oyunlar/transfer-rotasi",
    title: "Transfer Rotası",
    tagline: "Kariyer İzi",
    icon: "TR",
    color: "#e07856",
    glow: "rgba(224,120,86,0.2)",
  },
];

export default function GamesPage() {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-7xl px-4 pb-20 pt-10"
    >
      <header className="mb-8 text-center">
        <p className="eyebrow">İlk Onbir</p>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide text-ink sm:text-5xl">
          Oyun<span className="text-neon">lar</span>
        </h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
              style={{ borderColor: `${game.color}88`, color: game.color }}
              className="group relative flex min-h-56 flex-col justify-between overflow-hidden rounded-xl border bg-deep/78 p-5 shadow-lift backdrop-blur-xl transition hover:shadow-[0_0_34px_var(--game-glow)]"
              onMouseEnter={(event) => {
                event.currentTarget.style.setProperty("--game-glow", game.glow);
                event.currentTarget.style.borderColor = game.color;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.borderColor = `${game.color}88`;
              }}
            >
              <span
                className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-45"
                aria-hidden="true"
              />
              <span
                className="absolute right-4 top-4 h-8 w-8 rounded-full border border-current/25 opacity-20 transition group-hover:scale-150 group-hover:opacity-35"
                aria-hidden="true"
              />

              <div>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span
                    style={{ backgroundColor: game.color }}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold text-night"
                    aria-hidden="true"
                  >
                    {game.icon}
                  </span>
                  <p className="eyebrow text-right">{game.tagline}</p>
                </div>
                <h2 className="font-display text-2xl font-bold uppercase leading-tight tracking-wide text-ink">
                  {game.title}
                </h2>
              </div>

              <span
                style={{ borderColor: `${game.color}99`, color: game.color }}
                className="mt-8 inline-flex w-fit items-center gap-2 rounded-lg border px-4 py-2 font-display text-sm font-bold uppercase tracking-wide transition group-hover:bg-neon/10"
              >
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
