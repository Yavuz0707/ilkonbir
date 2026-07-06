import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * İmza öğesi: stadyum skorbordu gibi hane hane dönen rakamlar.
 * Değişen her karakter, mekanik bir rulo hissiyle dikeyde yuvarlanır;
 * haneler soldan sağa hafif gecikmeyle döner. Hareket azaltma tercihinde
 * animasyonsuz düz metne düşer.
 */
export default function ScoreboardValue({ text, className = "" }) {
  const reduceMotion = useReducedMotion();
  const chars = [...text];

  if (reduceMotion) {
    return (
      <span className={`font-mono tabular-nums ${className}`} aria-label={text}>
        {text}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex overflow-hidden font-mono tabular-nums ${className}`}
      aria-label={text}
    >
      {chars.map((ch, i) => (
        <span key={`${i}-${chars.length}`} className="relative inline-block">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch}
              initial={{ y: "-100%", opacity: 0, filter: "blur(3px)" }}
              animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
              exit={{ y: "100%", opacity: 0, filter: "blur(3px)" }}
              transition={{
                type: "spring",
                stiffness: 420,
                damping: 34,
                delay: i * 0.035,
              }}
              className="inline-block"
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
