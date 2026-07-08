import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import { ConfettiBurst, SoundToggle, useGameFeedback } from "../components/GameFeedback.jsx";
import PlayerAvatar from "../components/PlayerAvatar.jsx";
import ScoreboardValue from "../components/ScoreboardValue.jsx";

const POINTS_PER_CORRECT = 10;
const ADVANCE_DELAY_MS = 900;
const BEST_SCORE_KEY = "transfer-rotasi-best-score";

function readBestScore() {
  if (typeof window === "undefined") return 0;
  const parsed = parseInt(window.localStorage.getItem(BEST_SCORE_KEY) ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function shortDate(value) {
  if (!value) return null;
  const [year, month] = value.split("-");
  if (!year) return value;
  return month ? `${month}.${year}` : year;
}

function rangeLabel(item, index) {
  const start = shortDate(item.start_date);
  const end = shortDate(item.end_date);
  if (!start && end) return `${end} öncesi`;
  if (start && end) return `${start} - ${end}`;
  if (start && !end) return `${start} - bugün`;
  return index === 0 ? "İlk durak" : "Tarih bilinmiyor";
}

function OptionButton({ option, selected, isCorrect, revealed, disabled, onPick }) {
  const tone = !revealed
    ? selected
      ? "border-gold/80"
      : "border-mid/70 hover:border-neon/60"
    : isCorrect
      ? "border-neon shadow-glow"
      : selected
        ? "border-ember shadow-[0_0_28px_rgba(224,120,86,0.22)]"
        : "border-mid/40 opacity-60";

  return (
    <motion.button
      type="button"
      data-option-id={option.id}
      disabled={disabled}
      onClick={onPick}
      whileHover={disabled ? undefined : { y: -2, scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={`rounded-xl border bg-deep/75 px-4 py-3 text-left shadow-lift backdrop-blur-xl transition disabled:cursor-default ${tone}`}
    >
      <p className="font-display text-base font-bold uppercase tracking-wide text-ink">
        {option.name}
      </p>
    </motion.button>
  );
}

function RouteTimeline({ route }) {
  return (
    <div className="grid gap-3 lg:flex lg:items-stretch">
      {route.map((item, index) => (
        <div key={`${item.name}-${index}`} className="relative lg:flex-1">
          {index > 0 && (
            <span
              className="absolute -left-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-neon/40 bg-night px-1.5 py-0.5 font-display text-xs font-bold text-neon shadow-glow-sm lg:block"
              aria-hidden="true"
            >
              →
            </span>
          )}
          {index > 0 && (
            <span
              className="mx-auto -mt-1 mb-1 block w-fit rounded-full border border-neon/40 bg-night px-2 py-0.5 font-display text-xs font-bold text-neon lg:hidden"
              aria-hidden="true"
            >
              ↓
            </span>
          )}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.06 }}
            className="flex h-full items-center gap-3 rounded-xl border border-mid/70 bg-deep/75 p-3 shadow-lift lg:flex-col lg:justify-between lg:text-center"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-mid/60 bg-night/60 p-2">
              {item.logo_url ? (
                <img src={item.logo_url} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className="font-display text-lg font-bold text-neon">{item.name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-display text-base font-bold uppercase tracking-wide text-ink">
                {item.name}
              </p>
              <p className="mt-1 font-mono text-xs text-ink-muted">{rangeLabel(item, index)}</p>
            </div>
          </motion.div>
        </div>
      ))}
    </div>
  );
}

export default function TransferRouteGamePage() {
  const [round, setRound] = useState(null);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(readBestScore);
  const [selectedId, setSelectedId] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const feedback = useGameFeedback();

  const loadRound = useCallback(async ({ reset = false } = {}) => {
    setLoading(true);
    setError(null);
    setSelectedId(null);
    setRevealed(false);
    if (reset) {
      setScore(0);
      setGameOver(false);
    }
    try {
      setRound(await api.transferRouteNext());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRound({ reset: true });
  }, [loadRound]);

  useEffect(() => {
    window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }, [bestScore]);

  const handlePick = useCallback(
    (optionId) => {
      if (!round || revealed || gameOver) return;
      const correct = optionId === round.correct_id;
      setSelectedId(optionId);
      setRevealed(true);

      if (!correct) {
        feedback.playWrong();
        setBestScore((best) => Math.max(best, score));
        setGameOver(true);
        return;
      }

      const nextScore = score + POINTS_PER_CORRECT;
      feedback.playCorrect();
      if (nextScore > bestScore) feedback.celebrate();
      setScore(nextScore);
      setBestScore((best) => Math.max(best, nextScore));
      window.setTimeout(() => loadRound(), ADVANCE_DELAY_MS);
    },
    [bestScore, feedback, gameOver, loadRound, revealed, round, score]
  );

  const correctOption = round?.options.find((option) => option.id === round.correct_id);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto min-h-screen max-w-6xl px-4 pb-10 pt-6"
    >
      <ConfettiBurst burst={feedback.burst} />
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Oyunlar</p>
          <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-wide text-ink sm:text-5xl">
            Transfer <span className="text-neon">Rotası</span>
          </h1>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-mid/60 bg-deep/70 px-4 py-2.5 sm:min-w-64">
          <div>
            <p className="eyebrow">Skor</p>
            <ScoreboardValue text={String(score)} className="text-2xl font-semibold text-neon sm:text-3xl" />
          </div>
          <div>
            <p className="eyebrow">Rekor</p>
            <ScoreboardValue text={String(bestScore)} className="text-2xl font-semibold text-gold sm:text-3xl" />
          </div>
        </div>
        <SoundToggle enabled={feedback.soundEnabled} onChange={feedback.setSoundEnabled} />
      </header>

      {loading ? (
        <div className="space-y-5">
          <div className="skeleton h-44 rounded-xl" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        </div>
      ) : error ? (
        <section className="rounded-xl border border-ember/50 bg-deep/75 p-6 text-center">
          <p className="font-display text-xl font-bold text-ember">{error}</p>
          <button
            type="button"
            onClick={() => loadRound({ reset: true })}
            className="mt-4 rounded-lg border border-neon/70 px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-neon"
          >
            Tekrar dene
          </button>
        </section>
      ) : round ? (
        <>
          <section className="rounded-xl border border-mid/70 bg-night/35 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Gizli Oyuncu</p>
                <p className="text-sm text-ink-muted">Kulüp geçmişinden doğru ismi bul.</p>
              </div>
              <span className="rounded-lg border border-mid/60 bg-deep/70 px-3 py-1 font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
                {round.route.length} durak
              </span>
            </div>
            <RouteTimeline route={round.route} />
          </section>

          <section className="mt-5 grid gap-3 sm:grid-cols-2">
            {round.options.map((option) => (
              <OptionButton
                key={option.id}
                option={option}
                selected={selectedId === option.id}
                isCorrect={option.id === round.correct_id}
                revealed={revealed}
                disabled={revealed || gameOver}
                onPick={() => handlePick(option.id)}
              />
            ))}
          </section>

          {revealed && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mx-auto mt-5 max-w-xl rounded-xl border p-4 text-center shadow-lift ${
                selectedId === round.correct_id
                  ? "border-neon/70 bg-neon/10"
                  : "border-ember/60 bg-ember/10"
              }`}
            >
              <p className="eyebrow">{selectedId === round.correct_id ? "Doğru" : "Yanlış"}</p>
              <div className="mt-2 flex items-center justify-center gap-3">
                {correctOption && <PlayerAvatar player={correctOption} size="sm" />}
                <h2 className="font-display text-2xl font-bold uppercase text-ink">
                  {round.correct_name}
                </h2>
              </div>
              {gameOver && (
                <button
                  type="button"
                  onClick={() => loadRound({ reset: true })}
                  className="mt-4 rounded-lg border border-neon/70 bg-neon/10 px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-neon transition hover:bg-neon/15"
                >
                  Tekrar Oyna
                </button>
              )}
            </motion.section>
          )}
        </>
      ) : null}
    </motion.main>
  );
}
