import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Formasyon seçimi: aktif formasyonu gösteren tek bir chip; tıklanınca
 * diğer seçenekleri listeleyen bir popover açılır. Seçim yapılınca kapanır.
 */
export default function FormationSelector({ formations, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = formations.find((f) => f.id === value);

  // Dışarı tıklayınca / Esc ile kapan
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const select = (id) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <p className="eyebrow mb-2">Formasyon</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-mid/70 bg-deep px-3 py-2 font-display text-lg font-bold tracking-wider text-neon shadow-glow-sm transition hover:border-neon/60 disabled:cursor-wait disabled:opacity-50"
      >
        <span>{active?.name ?? "—"}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-ink-muted"
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-lg border border-mid/70 bg-deep/95 shadow-lift backdrop-blur-xl"
          >
            {formations.map((f) => (
              <li key={f.id} role="option" aria-selected={f.id === value}>
                <button
                  type="button"
                  onClick={() => select(f.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left font-display text-base font-bold tracking-wider transition ${
                    f.id === value
                      ? "bg-neon/10 text-neon"
                      : "text-ink-muted hover:bg-mid/25 hover:text-ink"
                  }`}
                >
                  {f.name}
                  {f.id === value && <span className="text-xs">●</span>}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
