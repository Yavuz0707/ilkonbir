import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const GAMES = [
  {
    to: "/oyunlar/kim-daha-iyi",
    title: "Kim Daha İyi?",
    tagline: "Higher / Lower",
    icon: "⚔️",
    description:
      "İki oyuncu karşı karşıya. Piyasa değeri, kariyer golü ya da asisti — hangisi daha yüksek? Doğru bildikçe serini uzat, rekorunu kır.",
  },
  {
    to: "/oyunlar/logo-bulmaca",
    title: "Logo Bulmaca",
    tagline: "10 Tur",
    icon: "🛡️",
    description:
      "Ekrandaki kulüp armasını 4 şık arasından bul. Her doğru +10 puan — 10 turda kaç puan toplayabilirsin?",
  },
  {
    to: "/oyunlar/transfer-rotasi",
    title: "Transfer Rotası",
    tagline: "Kariyer İzi",
    icon: "TR",
    description:
      "Gizli oyuncunun kulüp yolculuğunu takip et. Logolar ve tarih aralıkları ipucun; doğru ismi buldukça serini uzat.",
  },
];

export default function GamesPage() {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-5xl px-4 pb-20 pt-10"
    >
      <header className="mb-8 text-center">
        <p className="eyebrow">İlk Onbir</p>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide text-ink sm:text-5xl">
          Oyun<span className="text-neon">lar</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
          Futbol bilgini test et. Bir oyun seç ve rekorunu kır.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((game, i) => (
          <motion.div
            key={game.to}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.08 }}
          >
            <Link
              to={game.to}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-mid/70 bg-deep/75 p-6 shadow-lift backdrop-blur-xl transition hover:border-neon/70 hover:shadow-glow"
            >
              <span
                className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-neon/70 to-transparent opacity-40"
                aria-hidden="true"
              />
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden="true">
                  {game.icon}
                </span>
                <div>
                  <p className="eyebrow">{game.tagline}</p>
                  <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-ink">
                    {game.title}
                  </h2>
                </div>
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-muted">
                {game.description}
              </p>
              <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg border border-neon/60 bg-neon/10 px-4 py-2 font-display text-sm font-bold uppercase tracking-wide text-neon transition group-hover:bg-neon/15">
                Oyna
                <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
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
