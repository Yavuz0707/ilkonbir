import { Link } from "react-router-dom";
import { motion } from "framer-motion";

/** Placeholder "Yakında" sayfası (Dünya Kupası, İstatistikler, Oyuncular). */
export default function ComingSoonPage({ title }) {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 text-center"
    >
      <span className="eyebrow mb-3">Hazırlık Aşamasında</span>
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-ink sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-muted">
        Bu bölüm çok yakında burada olacak. Şimdilik takımını kurmaya devam
        edebilir, gerçek kadrolar ve piyasa değerleriyle oynayabilirsin.
      </p>
      <Link
        to="/"
        className="mt-8 rounded-lg bg-neon px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-night shadow-glow-sm transition hover:brightness-110"
      >
        Ana Sayfaya Dön
      </Link>
    </motion.main>
  );
}
