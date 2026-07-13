import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function ComingSoonPage({ title }) {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="theme-stats page-shell flex min-h-[76vh] flex-col items-center justify-center py-10 text-center"
    >
      <section className="page-hero w-full max-w-3xl px-6 py-12">
        <span className="motif-lines" aria-hidden="true" />
        <span className="eyebrow">Veri Merkezi</span>
        <h1 className="mt-3 font-display text-5xl font-black uppercase tracking-wide text-ink sm:text-7xl">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink-muted">
          Bu bölüm yakında turkuaz ve sarı vurgulu analiz dashboard'u olarak açılacak.
          Şimdilik kulüpler, oyuncular ve oyun ekranlarından devam edebilirsin.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--accent)_82%,white)] shadow-glow-sm transition hover:bg-white/[0.06]"
        >
          Ana Sayfaya Dön
        </Link>
      </section>
    </motion.main>
  );
}
