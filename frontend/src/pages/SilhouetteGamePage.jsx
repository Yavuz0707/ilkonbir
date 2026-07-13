import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import { ConfettiBurst, SoundToggle, useGameFeedback } from "../components/GameFeedback.jsx";
import ScoreboardValue from "../components/ScoreboardValue.jsx";

const ROUND_COUNT = 10;
const POINTS_BY_REVEAL = [30, 20, 10];
const PHOTO_HINT_CLASSES = [
  "scale-105 blur-md saturate-90 opacity-100 drop-shadow-[0_0_22px_rgba(107,255,160,0.22)]",
  "scale-[1.03] blur-sm saturate-95 opacity-100 drop-shadow-[0_0_22px_rgba(107,255,160,0.22)]",
  "scale-100 blur-[2px] saturate-100 opacity-100 drop-shadow-[0_0_22px_rgba(107,255,160,0.22)]",
];
const BEST_SCORE_KEY = "kim-bu-siluet-best-score";

function readBestScore() {
  if (typeof window === "undefined") return 0;
  const parsed = parseInt(window.localStorage.getItem(BEST_SCORE_KEY) ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
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
      disabled={disabled}
      onClick={onPick}
      whileHover={disabled ? undefined : { y: -2, scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={`rounded-xl border bg-deep/75 px-4 py-3 text-left shadow-lift backdrop-blur-xl transition disabled:cursor-default ${tone}`}
    >
      <div className="flex items-center gap-3">
        {option.club_logo && (
          <img src={option.club_logo} alt="" className="h-7 w-7 shrink-0 object-contain" />
        )}
        <div className="min-w-0">
          <p className="font-display text-base font-bold uppercase tracking-wide text-ink">
            {option.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            {option.club_name || "Kulüp bilinmiyor"}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

export default function SilhouetteGamePage() {
  const [round, setRound] = useState(null);
  const [usedIds, setUsedIds] = useState([]);
  const [roundIndex, setRoundIndex] = useState(1);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(readBestScore);
  const [selectedId, setSelectedId] = useState(null);
  const [revealLevel, setRevealLevel] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageBroken, setImageBroken] = useState(false);
  const feedback = useGameFeedback();

  const loadRound = useCallback(async (excludeIds = []) => {
    setLoading(true);
    setError(null);
    setSelectedId(null);
    setRevealLevel(0);
    setRevealed(false);
    setImageBroken(false);
    try {
      const next = await api.silhouetteNext({ exclude_ids: excludeIds.join(",") });
      setRound(next);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUsedIds([]);
    setRoundIndex(1);
    setScore(0);
    setRevealLevel(0);
    setGameOver(false);
    loadRound([]);
  }, [loadRound]);

  useEffect(() => {
    window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }, [bestScore]);

  const restart = useCallback(() => {
    setUsedIds([]);
    setRoundIndex(1);
    setScore(0);
    setGameOver(false);
    loadRound([]);
  }, [loadRound]);

  const handlePick = useCallback(
    (optionId) => {
      if (!round || revealed || gameOver) return;
      const correct = optionId === round.correct_id;
      const currentPoints = POINTS_BY_REVEAL[revealLevel] ?? 10;
      const nextScore = correct ? score + currentPoints : score;
      setSelectedId(optionId);
      setRevealed(true);
      setScore(nextScore);
      if (correct) {
        feedback.playCorrect();
        if (nextScore > bestScore) feedback.celebrate();
      } else {
        feedback.playWrong();
      }
      setBestScore((best) => Math.max(best, nextScore));

      const nextUsedIds = [...usedIds, round.correct_id];
      if (!correct || roundIndex >= ROUND_COUNT) {
        setUsedIds(nextUsedIds);
        setGameOver(true);
        return;
      }

      window.setTimeout(() => {
        setUsedIds(nextUsedIds);
        setRoundIndex((value) => value + 1);
        loadRound(nextUsedIds);
      }, 950);
    },
    [bestScore, feedback, gameOver, loadRound, revealLevel, revealed, round, roundIndex, score, usedIds]
  );

  const correctOption = round?.options.find((option) => option.id === round.correct_id);
  const currentPoints = POINTS_BY_REVEAL[revealLevel] ?? 10;

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
            Kim Bu <span className="text-neon">Silüet?</span>
          </h1>
        </div>
        <div className="grid grid-cols-4 gap-3 rounded-xl border border-white/10 bg-void/55 px-4 py-2.5 sm:min-w-80">
          <div>
            <p className="eyebrow">Tur</p>
            <ScoreboardValue text={`${roundIndex}/${ROUND_COUNT}`} className="text-2xl font-semibold text-ink sm:text-3xl" />
          </div>
          <div>
            <p className="eyebrow">Puan</p>
            <ScoreboardValue text={String(currentPoints)} className="text-2xl font-semibold text-neon sm:text-3xl" />
          </div>
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
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="skeleton h-[420px] rounded-xl" />
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
            onClick={restart}
            className="mt-4 rounded-lg border border-neon/70 px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-neon"
          >
            Tekrar dene
          </button>
        </section>
      ) : round ? (
        <>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-stretch">
            <section className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-xl border border-mid/70 bg-night/45 p-5 shadow-lift">
              {imageBroken ? (
                <div className="flex h-72 w-72 items-center justify-center rounded-full border border-mid/70 bg-deep/80 font-display text-6xl font-bold text-neon">
                  ?
                </div>
              ) : (
                <img
                  src={round.photo_url}
                  alt=""
                  onError={() => setImageBroken(true)}
                  className={`max-h-[360px] max-w-full object-contain transition duration-300 ${
                    revealed
                      ? "blur-0 brightness-100 drop-shadow-[0_0_28px_rgba(107,255,160,0.2)]"
                      : PHOTO_HINT_CLASSES[revealLevel]
                  }`}
                />
              )}
              {!revealed && !imageBroken && (
                <button
                  type="button"
                  onClick={() => setRevealLevel((level) => Math.min(level + 1, 2))}
                  disabled={revealLevel >= 2}
                  className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-lg border border-gold/70 bg-gold/10 px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-gold shadow-lift transition hover:bg-gold/15 disabled:cursor-default disabled:opacity-50"
                >
                  Netleştir
                </button>
              )}
            </section>

            <section className="grid content-start gap-3 sm:grid-cols-2">
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
          </div>

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
              <h2 className="mt-1 font-display text-2xl font-bold uppercase text-ink">
                {correctOption?.name}
              </h2>
              {gameOver && (
                <button
                  type="button"
                  onClick={restart}
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
