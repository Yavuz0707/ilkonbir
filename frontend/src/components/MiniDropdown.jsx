import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Küçük chip + popover seçici (lig/sezon için).
 * `options`: [{value, label, sublabel?}] — `sublabel` soluk yardımcı metin
 * olarak gösterilir (örn. lig adının yanında sezon: "2025-26").
 * `value` seçili değer; null = ilk (örn. "Genel").
 */
export default function MiniDropdown({ options, value, onChange, placeholder = "Seç" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-md border border-mid/60 bg-deep/70 px-2 py-1 font-display text-xs font-bold tracking-wide text-neon transition hover:border-neon/60"
      >
        <span className="max-w-40 truncate">
          {active ? active.label : placeholder}
          {active?.sublabel && (
            <span className="ml-1 font-sans font-normal normal-case text-ink-faint">
              {active.sublabel}
            </span>
          )}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-ink-faint">
          ▾
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="thin-scroll absolute right-0 z-30 mt-1 max-h-64 min-w-40 overflow-y-auto rounded-lg border border-mid/70 bg-deep/95 py-1 shadow-lift backdrop-blur-xl"
          >
            {options.map((o) => (
              <li key={String(o.value)} role="option" aria-selected={o.value === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition ${
                    o.value === value
                      ? "bg-neon/10 font-semibold text-neon"
                      : "text-ink-muted hover:bg-mid/25 hover:text-ink"
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {o.sublabel && (
                    <span className="shrink-0 text-xs font-normal text-ink-faint">
                      {o.sublabel}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
