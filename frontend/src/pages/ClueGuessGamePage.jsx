import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import { ConfettiBurst, SoundToggle, useGameFeedback } from "../components/GameFeedback.jsx";
import ScoreboardValue from "../components/ScoreboardValue.jsx";

const BEST_SCORE_KEY = "ipucu-tahmin-best-score";
const POINTS_BY_HINTS = { 1: 30, 2: 20, 3: 10 };

function readBestScore() {
  if (typeof window === "undefined") return 0;
  const parsed = parseInt(window.localStorage.getItem(BEST_SCORE_KEY) ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeGuess(value) {
  return value.trim();
}

export default function ClueGuessGamePage() {
  const [round, setRound] = useState(null);
  const [visibleHints, setVisibleHints] = useState(1);
  const [guess, setGuess] = useState("");
  const [answer, setAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(readBestScore);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const feedback = useGameFeedback();

  const currentPoints = POINTS_BY_HINTS[Math.min(visibleHints, 3)] ?? 0;
  const shownHints = useMemo(
    () => (round?.hints ?? []).slice(0, visibleHints),
    [round, visibleHints]
  );

  const loadRound = useCallback(async () => {
    setLoading(true);
    setSubmitting(false);
    setError(null);
    setGuess("");
    setAnswer(null);
    setVisibleHints(1);
    try {
      setRound(await api.clueGuessNext());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRound();
  }, [loadRound]);

  useEffect(() => {
    window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }, [bestScore]);

  const revealHint = useCallback(() => {
    if (!round || answer) return;
    if (visibleHints < Math.min(3, round.hints.length)) {
      setVisibleHints((value) => value + 1);
    }
  }, [answer, round, visibleHints]);

  const submitGuess = useCallback(
    async ({ pass = false } = {}) => {
      if (!round || submitting || answer) return;
      const cleanGuess = pass ? "" : normalizeGuess(guess);
      if (!pass && !cleanGuess) return;
      setSubmitting(true);
      setError(null);
      try {
        const result = await api.clueGuessAnswer({
          answer_token: round.answer_token,
          guess: cleanGuess,
          revealed_hint_count: visibleHints,
        });
        setAnswer(result);
        if (result.correct) {
          const nextScore = score + result.points;
          const nextStreak = streak + 1;
          setScore(nextScore);
          setStreak(nextStreak);
          feedback.playCorrect();
          if (nextScore > bestScore) feedback.celebrate();
          setBestScore((best) => Math.max(best, nextScore));
        } else {
          feedback.playWrong();
          setStreak(0);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setSubmitting(false);
      }
    },
    [answer, bestScore, feedback, guess, round, score, streak, submitting, visibleHints]
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
            İpucu <span className="text-neon">Tahmin</span>
          </h1>
        </div>
        <div className="grid grid-cols-3 gap-3 rounded-xl border border-white/10 bg-void/55 px-4 py-2.5 sm:min-w-80">
          <div>
            <p className="eyebrow">Puan</p>
            <ScoreboardValue text={String(currentPoints)} className="text-2xl font-semibold text-ink sm:text-3xl" />
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
        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="skeleton h-72 rounded-xl" />
          <div className="skeleton h-72 rounded-xl" />
        </div>
      ) : error && !round ? (
        <section className="rounded-xl border border-ember/50 bg-deep/75 p-6 text-center">
          <p className="font-display text-xl font-bold text-ember">{error}</p>
          <button
            type="button"
            onClick={loadRound}
            className="mt-4 rounded-lg border border-neon/70 px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-neon"
          >
            Tekrar dene
          </button>
        </section>
      ) : round ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <section className="rounded-xl border border-mid/70 bg-deep/75 p-5 shadow-lift">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Açık İpuçları</p>
                <h2 className="mt-1 font-display text-2xl font-bold uppercase text-ink">
                  {visibleHints}/{round.hints.length}
                </h2>
              </div>
              <span className="rounded-lg border border-gold/50 bg-gold/10 px-3 py-1 font-display text-xs font-bold uppercase tracking-wide text-gold">
                {currentPoints} puan
              </span>
            </div>

            <div className="space-y-3">
              {shownHints.map((hint, index) => (
                <motion.div
                  key={`${hint.kind}-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-mid/60 bg-night/45 p-4"
                >
                  <p className="eyebrow">{hint.label}</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{hint.text}</p>
                </motion.div>
              ))}
            </div>

            <button
              type="button"
              onClick={revealHint}
              disabled={Boolean(answer) || visibleHints >= round.hints.length}
              className="mt-4 rounded-lg border border-neon/70 bg-neon/10 px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-neon transition hover:bg-neon/15 disabled:cursor-default disabled:opacity-50"
            >
              Yeni İpucu Al
            </button>
          </section>

          <section className="rounded-xl border border-mid/70 bg-night/40 p-5 shadow-lift">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="eyebrow">Tahmin</p>
                <h2 className="mt-1 font-display text-2xl font-bold uppercase text-ink">
                  Oyuncu kim?
                </h2>
              </div>
              <span className="rounded-lg border border-mid/60 bg-deep/70 px-3 py-1 font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
                Seri {streak}
              </span>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitGuess();
              }}
              className="space-y-3"
            >
              <input
                value={guess}
                disabled={Boolean(answer)}
                onChange={(event) => setGuess(event.target.value)}
                placeholder="Oyuncu adını yaz"
                className="w-full rounded-xl border border-mid/70 bg-deep/80 px-4 py-3 text-base text-ink outline-none transition placeholder:text-ink-faint focus:border-neon focus:shadow-glow-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={submitting || Boolean(answer) || !normalizeGuess(guess)}
                  className="rounded-lg border border-neon/70 bg-neon/10 px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-neon transition hover:bg-neon/15 disabled:cursor-default disabled:opacity-50"
                >
                  Tahmin Et
                </button>
                <button
                  type="button"
                  onClick={() => submitGuess({ pass: true })}
                  disabled={submitting || Boolean(answer)}
                  className="rounded-lg border border-mid/70 px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-ink-muted transition hover:border-ember/60 hover:text-ember disabled:cursor-default disabled:opacity-50"
                >
                  Pas Geç
                </button>
              </div>
            </form>

            {error && <p className="mt-3 text-sm font-semibold text-ember">{error}</p>}

            {answer && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-5 rounded-xl border p-4 ${
                  answer.correct ? "border-neon/70 bg-neon/10" : "border-ember/60 bg-ember/10"
                }`}
              >
                <p className="eyebrow">{answer.correct ? "Doğru" : "Cevap"}</p>
                <div className="mt-3 flex items-center gap-3">
                  {answer.photo_url && (
                    <img
                      src={answer.photo_url}
                      alt=""
                      className="h-16 w-16 rounded-full border border-mid/60 object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="font-display text-2xl font-bold uppercase text-ink">
                      {answer.correct_name}
                    </h3>
                    <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted">
                      {answer.club_logo && (
                        <img src={answer.club_logo} alt="" className="h-4 w-4 object-contain" />
                      )}
                      {answer.club_name || "Kulüp bilinmiyor"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={loadRound}
                  className="mt-4 rounded-lg border border-neon/70 bg-neon/10 px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-neon transition hover:bg-neon/15"
                >
                  Sonraki Oyuncu
                </button>
              </motion.div>
            )}
          </section>
        </div>
      ) : null}
    </motion.main>
  );
}
