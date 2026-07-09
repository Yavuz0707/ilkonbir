import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import { ConfettiBurst, SoundToggle, useGameFeedback } from "../components/GameFeedback.jsx";
import PlayerAvatar from "../components/PlayerAvatar.jsx";
import ScoreboardValue from "../components/ScoreboardValue.jsx";
import { formatValue } from "../utils/format";

const CATEGORIES = [
  { key: "market_value", label: "Piyasa Değeri" },
  { key: "goals", label: "Gol" },
  { key: "assists", label: "Asist" },
];

const POINTS_PER_CORRECT = 10;
const ROUND_RETRY_LIMIT = 3;
const BEST_SCORE_KEY = "kim-daha-iyi-best-score";

function readBestScore() {
  if (typeof window === "undefined") return 0;
  const parsed = parseInt(window.localStorage.getItem(BEST_SCORE_KEY) ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatMetric(category, value) {
  if (category === "market_value") return formatValue(value);
  return `${value.toLocaleString("tr-TR")} ${category === "goals" ? "Gol" : "Asist"}`;
}

function metricLabel(category) {
  if (category === "market_value") return "Piyasa Değeri";
  // Transfermarkt gercek kariyer toplamini vermiyor (profil/stats endpoint'i bos
  // donuyor); bu deger yalnizca sisteme senkronize edilmis sezonlarin toplami.
  // Kullaniciyi yanlis bilgilendirmemek icin durustce etiketlenir + tooltip.
  return category === "goals" ? "Gol (Kayıtlı Sezonlar)" : "Asist (Kayıtlı Sezonlar)";
}

const SEASON_SCOPE_NOTE =
  "Bu değer, sistemde kayıtlı sezonların toplamıdır; oyuncunun tüm kariyerini kapsamayabilir.";

async function fetchNonTiedRound(params) {
  let lastRound = null;
  for (let i = 0; i < ROUND_RETRY_LIMIT; i += 1) {
    const round = await api.higherLowerNext(params);
    lastRound = round;
    if (round.left.value !== round.right.value && round.higher_id) return round;
  }
  throw new Error(
    lastRound ? "Bu kategori için yeterli farklı veri yok" : "Tur yüklenemedi"
  );
}

function GameCard({ card, category, visible, selected, result, disabled, onPick }) {
  const tone =
    result === "correct"
      ? "border-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.26)]"
      : result === "wrong"
        ? "border-ember shadow-[0_0_28px_rgba(224,120,86,0.22)]"
        : selected
          ? "border-fuchsia-300/80"
          : "border-white/10 hover:border-fuchsia-300/60";

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onPick}
      whileHover={disabled ? undefined : { y: -3, scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={`group relative flex min-h-[285px] w-full flex-col items-center justify-between overflow-hidden rounded-2xl border bg-deep/78 p-4 text-center shadow-lift backdrop-blur-xl transition sm:min-h-[315px] ${tone} disabled:cursor-default`}
    >
      <span
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-fuchsia-300/70 to-cyan-300/70 opacity-70"
        aria-hidden="true"
      />

      <div className="flex flex-col items-center">
        <div className="relative">
          <span className="absolute inset-0 rounded-full bg-fuchsia-300/10 blur-xl" aria-hidden="true" />
          <PlayerAvatar player={card} size="md" />
        </div>
        <h2 className="mt-3 font-display text-xl font-bold uppercase leading-tight tracking-wide text-ink sm:text-2xl">
          {card.name}
        </h2>
        <div className="mt-2 flex min-h-6 items-center justify-center gap-2 text-xs text-ink-muted sm:text-sm">
          {card.club_logo && (
            <img src={card.club_logo} alt="" className="h-4 w-4 object-contain sm:h-5 sm:w-5" />
          )}
          <span>{card.club_name || "Kulüp bilinmiyor"}</span>
        </div>
      </div>

      <div className="w-full">
        <p className="eyebrow mb-1.5 inline-flex items-center justify-center gap-1">
          {metricLabel(category)}
          {category !== "market_value" && (
            <span
              title={SEASON_SCOPE_NOTE}
              aria-label={SEASON_SCOPE_NOTE}
              className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-ink-faint/70 text-[8px] font-bold leading-none text-ink-faint"
            >
              i
            </span>
          )}
        </p>
        <div className="rounded-xl border border-white/10 bg-night/70 px-3 py-3">
          {visible ? (
            <ScoreboardValue
              text={formatMetric(category, card.value)}
              className="justify-center text-2xl font-semibold text-cyan-300 sm:text-3xl"
            />
          ) : (
            <span className="font-display text-4xl font-bold text-gold">?</span>
          )}
        </div>
        <span className="mt-3 inline-flex rounded-lg border border-white/10 px-3 py-1 font-display text-[11px] font-bold uppercase tracking-wider text-ink-muted transition group-hover:text-fuchsia-200">
          Daha yüksek
        </span>
      </div>
    </motion.button>
  );
}

export default function HigherLowerGamePage() {
  const [category, setCategory] = useState("market_value");
  const [round, setRound] = useState(null);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(readBestScore);
  const [selectedId, setSelectedId] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const feedback = useGameFeedback();

  const loadFirstRound = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRound(null);
    setScore(0);
    setSelectedId(null);
    setRevealed(false);
    setResult(null);
    setGameOver(false);
    try {
      setRound(await fetchNonTiedRound({ category }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    loadFirstRound();
  }, [loadFirstRound]);

  // Rekor kalici: sayfa degistirilip geri donulunce (component remount) korunur.
  useEffect(() => {
    window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }, [bestScore]);

  const handlePick = useCallback(
    async (card) => {
      if (!round || revealed || gameOver) return;

      if (round.left.value === round.right.value || !round.higher_id) {
        try {
          setRound(await fetchNonTiedRound({ category, exclude_player_id: card.id }));
          setSelectedId(null);
          setRevealed(false);
          setResult(null);
        } catch (e) {
          setError(e.message);
          setGameOver(true);
        }
        return;
      }

      const correct = card.id === round.higher_id;
      const winner = round.higher_id === round.left.id ? round.left : round.right;
      const loser = round.higher_id === round.left.id ? round.right : round.left;

      setSelectedId(card.id);
      setRevealed(true);
      setResult(correct ? "correct" : "wrong");

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

      window.setTimeout(async () => {
        try {
          const next = await fetchNonTiedRound({
            category,
            anchor_id: winner.id,
            exclude_player_id: loser.id,
          });
          setRound(next);
          setSelectedId(null);
          setRevealed(false);
          setResult(null);
        } catch (e) {
          setError(e.message);
          setGameOver(true);
        }
      }, 800);
    },
    [bestScore, category, feedback, gameOver, revealed, round, score]
  );

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="theme-games mx-auto min-h-screen max-w-6xl px-4 pb-10 pt-6"
    >
      <ConfettiBurst burst={feedback.burst} />
      <header className="section-shell relative mb-5 overflow-hidden rounded-2xl border border-white/10 bg-deep/65 p-5 shadow-lift sm:flex sm:items-end sm:justify-between">
        <span className="motif-lines" aria-hidden="true" />
        <div>
          <p className="eyebrow">Oyunlar</p>
          <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-wide text-ink sm:text-5xl">
            Kim Daha <span className="text-fuchsia-300">İyi?</span>
          </h1>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-night/55 px-4 py-2.5 sm:mt-0 sm:min-w-64">
          <div>
            <p className="eyebrow">Skor</p>
            <ScoreboardValue text={String(score)} className="text-2xl font-semibold text-cyan-300 sm:text-3xl" />
          </div>
          <div>
            <p className="eyebrow">Rekor</p>
            <ScoreboardValue text={String(bestScore)} className="text-2xl font-semibold text-fuchsia-300 sm:text-3xl" />
          </div>
        </div>
        <SoundToggle enabled={feedback.soundEnabled} onChange={feedback.setSoundEnabled} />
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {CATEGORIES.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setCategory(item.key)}
            className={`rounded-lg border px-4 py-2 font-display text-sm font-bold uppercase tracking-wide transition ${
              category === item.key
                ? "border-fuchsia-300 bg-fuchsia-300/10 text-fuchsia-200 shadow-[0_0_18px_rgba(217,70,239,0.18)]"
                : "border-white/10 bg-deep/70 text-ink-muted hover:border-fuchsia-300/50 hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="skeleton h-[315px] rounded-xl" />
          <div className="skeleton h-[315px] rounded-xl" />
        </div>
      ) : error ? (
        <section className="rounded-xl border border-ember/50 bg-deep/75 p-6 text-center">
          <p className="font-display text-xl font-bold text-ember">{error}</p>
          <button
            type="button"
            onClick={loadFirstRound}
            className="mt-4 rounded-lg border border-fuchsia-300/70 px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-fuchsia-200"
          >
            Tekrar dene
          </button>
        </section>
      ) : round ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <GameCard
              card={round.left}
              category={category}
              visible={revealed || round.left.id === round.known_id}
              selected={selectedId === round.left.id}
              result={revealed && selectedId === round.left.id ? result : null}
              disabled={revealed || gameOver}
              onPick={() => handlePick(round.left)}
            />
            <div className="flex items-center justify-center">
              <span className="rounded-full border border-mid/70 bg-night px-4 py-2 font-display text-sm font-bold text-ink-muted shadow-lift">
                VS
              </span>
            </div>
            <GameCard
              card={round.right}
              category={category}
              visible={revealed || round.right.id === round.known_id}
              selected={selectedId === round.right.id}
              result={revealed && selectedId === round.right.id ? result : null}
              disabled={revealed || gameOver}
              onPick={() => handlePick(round.right)}
            />
          </div>

          {gameOver && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto mt-5 max-w-xl rounded-xl border border-ember/50 bg-deep/85 p-4 text-center shadow-lift"
            >
              <p className="eyebrow">Oyun bitti</p>
              <h2 className="mt-1 font-display text-2xl font-bold uppercase text-ink">
                Final skor: <span className="text-gold">{score}</span>
              </h2>
              <button
                type="button"
                onClick={loadFirstRound}
              className="mt-4 rounded-lg border border-fuchsia-300/70 bg-fuchsia-300/10 px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-fuchsia-200 transition hover:bg-fuchsia-300/15"
              >
                Tekrar Oyna
              </button>
            </motion.section>
          )}
        </>
      ) : null}
    </motion.main>
  );
}
