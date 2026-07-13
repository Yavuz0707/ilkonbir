import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import { ConfettiBurst, SoundToggle, useGameFeedback } from "../components/GameFeedback.jsx";
import ScoreboardValue from "../components/ScoreboardValue.jsx";

const TOTAL_ROUNDS = 10;
const POINTS_PER_CORRECT = 10;
const ADVANCE_DELAY_MS = 900;
const BEST_SCORE_KEY = "logo-bulmaca-best-score";

function readBestScore() {
  if (typeof window === "undefined") return 0;
  const parsed = parseInt(window.localStorage.getItem(BEST_SCORE_KEY) ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function OptionButton({ club, selected, isCorrect, revealed, disabled, onPick }) {
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
      disabled={disabled}
      onClick={onPick}
      whileHover={disabled ? undefined : { y: -2, scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={`rounded-xl border bg-deep/75 px-4 py-3 text-center font-display text-sm font-bold uppercase tracking-wide text-ink shadow-lift backdrop-blur-xl transition disabled:cursor-default sm:text-base ${tone}`}
    >
      {club.name}
    </motion.button>
  );
}

export default function LogoQuizGamePage() {
  const [roundIndex, setRoundIndex] = useState(1);
  const [usedIds, setUsedIds] = useState([]);
  const [round, setRound] = useState(null);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(readBestScore);
  const [selectedId, setSelectedId] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const feedback = useGameFeedback();

  const loadRound = useCallback(async (excludeIds) => {
    setLoading(true);
    setError(null);
    setSelectedId(null);
    setRevealed(false);
    try {
      const next = await api.logoQuizNext({ exclude_ids: excludeIds.join(",") });
      setRound(next);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const startGame = useCallback(() => {
    setRoundIndex(1);
    setUsedIds([]);
    setScore(0);
    setGameOver(false);
    loadRound([]);
  }, [loadRound]);

  useEffect(() => {
    startGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rekor kalici: sayfa degistirilip geri donulunce korunur.
  useEffect(() => {
    window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }, [bestScore]);

  const handlePick = useCallback(
    (clubId) => {
      if (!round || revealed || gameOver) return;

      const correct = clubId === round.correct_id;
      setSelectedId(clubId);
      setRevealed(true);
      const nextScore = correct ? score + POINTS_PER_CORRECT : score;
      if (correct) {
        feedback.playCorrect();
        if (nextScore > bestScore) feedback.celebrate();
        setScore(nextScore);
        setBestScore((best) => Math.max(best, nextScore));
      } else {
        feedback.playWrong();
      }

      window.setTimeout(() => {
        const nextUsedIds = [...usedIds, round.correct_id];
        if (roundIndex >= TOTAL_ROUNDS) {
          setBestScore((best) => Math.max(best, nextScore));
          setGameOver(true);
          return;
        }
        setUsedIds(nextUsedIds);
        setRoundIndex((r) => r + 1);
        loadRound(nextUsedIds);
      }, ADVANCE_DELAY_MS);
    },
    [bestScore, feedback, gameOver, loadRound, revealed, round, roundIndex, score, usedIds]
  );

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="theme-games page-shell min-h-screen pb-10 pt-6"
    >
      <ConfettiBurst burst={feedback.burst} />
      <header className="page-hero mb-5 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Oyunlar</p>
          <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-wide text-ink sm:text-5xl">
            Logo <span className="text-neon">Bulmaca</span>
          </h1>
        </div>
        <div className="grid grid-cols-3 gap-3 rounded-xl border border-white/10 bg-void/55 px-4 py-2.5 sm:min-w-80">
          <div>
            <p className="eyebrow">Tur</p>
            <ScoreboardValue
              text={`${Math.min(roundIndex, TOTAL_ROUNDS)}/${TOTAL_ROUNDS}`}
              className="text-2xl font-semibold text-ink sm:text-3xl"
            />
          </div>
          <div>
            <p className="eyebrow">Skor</p>
            <ScoreboardValue text={String(score)} className="text-2xl font-semibold text-[color-mix(in_srgb,var(--accent)_84%,white)] sm:text-3xl" />
          </div>
          <div>
            <p className="eyebrow">Rekor</p>
            <ScoreboardValue text={String(bestScore)} className="text-2xl font-semibold text-gold sm:text-3xl" />
          </div>
        </div>
        <SoundToggle enabled={feedback.soundEnabled} onChange={feedback.setSoundEnabled} />
      </header>

      {loading ? (
        <div className="mx-auto grid max-w-md gap-4">
          <div className="skeleton h-40 w-40 justify-self-center rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton h-14 rounded-xl" />
            <div className="skeleton h-14 rounded-xl" />
            <div className="skeleton h-14 rounded-xl" />
            <div className="skeleton h-14 rounded-xl" />
          </div>
        </div>
      ) : error ? (
        <section className="rounded-xl border border-ember/50 bg-deep/75 p-6 text-center">
          <p className="font-display text-xl font-bold text-ember">{error}</p>
          <button
            type="button"
            onClick={startGame}
            className="mt-4 rounded-lg border border-neon/70 px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-neon"
          >
            Tekrar dene
          </button>
        </section>
      ) : round && !gameOver ? (
        <>
          <div className="mb-6 flex justify-center">
            <div className="relative flex h-40 w-40 items-center justify-center rounded-2xl border border-mid/70 bg-deep/75 p-6 shadow-lift">
              <span className="absolute inset-0 rounded-2xl bg-neon/5 blur-xl" aria-hidden="true" />
              <img
                src={round.options.find((c) => c.id === round.correct_id)?.logo_url}
                alt="Kulüp logosu"
                className={`relative h-full w-full object-contain transition duration-300 ${
                  revealed
                    ? "blur-0 brightness-100"
                    : "scale-105 blur-sm saturate-90 opacity-100"
                }`}
              />
            </div>
          </div>

          <div className="mx-auto grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
            {round.options.map((club) => (
              <OptionButton
                key={club.id}
                club={club}
                selected={selectedId === club.id}
                isCorrect={club.id === round.correct_id}
                revealed={revealed}
                disabled={revealed}
                onPick={() => handlePick(club.id)}
              />
            ))}
          </div>
        </>
      ) : gameOver ? (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mt-5 max-w-xl rounded-xl border border-mid/60 bg-deep/85 p-6 text-center shadow-lift"
        >
          <p className="eyebrow">Oyun bitti</p>
          <h2 className="mt-1 font-display text-2xl font-bold uppercase text-ink">
            Final skor: <span className="text-gold">{score}</span> / {TOTAL_ROUNDS * POINTS_PER_CORRECT}
          </h2>
          <button
            type="button"
            onClick={startGame}
            className="mt-4 rounded-lg border border-neon/70 bg-neon/10 px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-neon transition hover:bg-neon/15"
          >
            Tekrar Oyna
          </button>
        </motion.section>
      ) : null}
    </motion.main>
  );
}
