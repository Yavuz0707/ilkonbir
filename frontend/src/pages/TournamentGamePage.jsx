import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import PlayerAvatar from "../components/PlayerAvatar.jsx";
import { formatValue, initials } from "../utils/format";

const MODES = [
  {
    key: "clubs",
    title: "Super Lig Takimlari",
    label: "Takim Turnuvasi",
    load: () => api.tournamentSuperligClubs({ size: 16 }),
  },
  {
    key: "players",
    title: "En Degerli Oyuncular",
    label: "Oyuncu Turnuvasi",
    load: () => api.tournamentPlayers({ size: 16 }),
  },
];

function roundLabel(count) {
  if (count >= 32) return "Son 32";
  if (count >= 16) return "Son 16";
  if (count >= 8) return "Ceyrek Final";
  if (count >= 4) return "Yari Final";
  if (count >= 2) return "Final";
  return "Sampiyon";
}

function pairsFor(items) {
  const pairs = [];
  for (let i = 0; i < items.length; i += 2) pairs.push([items[i], items[i + 1]]);
  return pairs;
}

function ClubBadge({ item }) {
  if (item.logo_url) {
    return (
      <img
        src={item.logo_url}
        alt=""
        className="h-20 w-20 object-contain sm:h-24 sm:w-24"
      />
    );
  }
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-mid/70 bg-night font-display text-xl font-bold text-neon sm:h-24 sm:w-24">
      {initials(item.name)}
    </div>
  );
}

function PlayerInfo({ item }) {
  return (
    <div className="mt-3 grid gap-1 text-xs text-ink-muted sm:text-sm">
      <span>{item.club_name || "Kulup bilinmiyor"}</span>
      <span>{item.detail_position || item.position || "Mevki bilinmiyor"}</span>
      <span className="font-display font-bold text-gold">{formatValue(item.market_value)}</span>
    </div>
  );
}

function OptionCard({ item, mode, selected, disabled, onPick }) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onPick}
      whileHover={disabled ? undefined : { y: -4, scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      animate={selected ? { y: -8, scale: 1.03 } : { y: 0, scale: 1 }}
      className={`relative flex min-h-[260px] flex-col items-center justify-center overflow-hidden rounded-xl border bg-deep/78 p-5 text-center shadow-lift backdrop-blur-xl transition ${
        selected
          ? "border-neon shadow-glow"
          : "border-mid/70 hover:border-neon/60"
      } disabled:cursor-default`}
    >
      <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-neon/70 to-transparent opacity-50" />
      <div className="relative flex h-28 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-neon/10 blur-2xl" aria-hidden="true" />
        <div className="relative">
          {mode === "players" ? <PlayerAvatar player={item} size="lg" /> : <ClubBadge item={item} />}
        </div>
      </div>
      <h2 className="mt-4 font-display text-2xl font-bold uppercase leading-tight text-ink sm:text-3xl">
        {item.name}
      </h2>
      {mode === "players" ? <PlayerInfo item={item} /> : <p className="mt-3 text-sm text-ink-muted">{item.league || item.country || "Super Lig"}</p>}
      <span className="mt-5 rounded-lg border border-neon/60 bg-neon/10 px-4 py-2 font-display text-xs font-bold uppercase tracking-wide text-neon">
        Sec
      </span>
    </motion.button>
  );
}

export default function TournamentGamePage() {
  const [mode, setMode] = useState(null);
  const [roundPlayers, setRoundPlayers] = useState([]);
  const [pairIndex, setPairIndex] = useState(0);
  const [winners, setWinners] = useState([]);
  const [history, setHistory] = useState([]);
  const [champion, setChampion] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const currentMode = MODES.find((item) => item.key === mode) || null;
  const pairs = useMemo(() => pairsFor(roundPlayers), [roundPlayers]);
  const currentPair = pairs[pairIndex] || [];
  const label = roundLabel(roundPlayers.length);

  const startGame = useCallback(async (nextMode = mode) => {
    const selectedMode = MODES.find((item) => item.key === nextMode);
    if (!selectedMode) return;
    setMode(nextMode);
    setLoading(true);
    setError(null);
    setChampion(null);
    setSelectedId(null);
    setPairIndex(0);
    setWinners([]);
    setHistory([]);
    try {
      const items = await selectedMode.load();
      setRoundPlayers(items);
    } catch (e) {
      setRoundPlayers([]);
      setError(e.message || "Turnuva verisi yuklenemedi");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  const pickWinner = useCallback((item) => {
    if (!item || selectedId || champion) return;
    setSelectedId(item.id);
    window.setTimeout(() => {
      const nextWinners = [...winners, item];
      const atRoundEnd = pairIndex >= pairs.length - 1;
      if (atRoundEnd) {
        setHistory((rows) => [...rows, { label, winners: nextWinners }]);
        if (nextWinners.length === 1) {
          setChampion(item);
          setRoundPlayers([]);
        } else {
          setRoundPlayers(nextWinners);
        }
        setPairIndex(0);
        setWinners([]);
      } else {
        setWinners(nextWinners);
        setPairIndex((index) => index + 1);
      }
      setSelectedId(null);
    }, 520);
  }, [champion, label, pairIndex, pairs.length, selectedId, winners]);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto min-h-screen max-w-6xl px-4 pb-10 pt-6"
    >
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Oyunlar</p>
          <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-wide text-ink sm:text-5xl">
            Turnuva <span className="text-neon">Oyunu</span>
          </h1>
        </div>
        {currentMode && !champion && roundPlayers.length > 0 && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-mid/60 bg-deep/70 px-4 py-2.5 sm:min-w-72">
            <div>
              <p className="eyebrow">Tur</p>
              <p className="font-display text-xl font-bold text-neon">{label}</p>
            </div>
            <div>
              <p className="eyebrow">Eslesme</p>
              <p className="font-display text-xl font-bold text-ink">
                {Math.min(pairIndex + 1, pairs.length)}/{pairs.length}
              </p>
            </div>
          </div>
        )}
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {MODES.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => startGame(item.key)}
            className={`rounded-lg border px-4 py-2 font-display text-sm font-bold uppercase tracking-wide transition ${
              mode === item.key
                ? "border-neon bg-neon/10 text-neon shadow-glow-sm"
                : "border-mid/70 bg-deep/70 text-ink-muted hover:border-neon/50 hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="skeleton h-[285px] rounded-xl" />
          <div className="hidden rounded-full border border-mid/70 bg-night px-4 py-2 font-display text-sm font-bold text-ink-muted lg:block">VS</div>
          <div className="skeleton h-[285px] rounded-xl" />
        </div>
      ) : error ? (
        <section className="rounded-xl border border-ember/50 bg-deep/75 p-6 text-center">
          <p className="font-display text-xl font-bold text-ember">{error}</p>
          <button
            type="button"
            onClick={() => startGame(mode)}
            className="mt-4 rounded-lg border border-neon/70 px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-neon"
          >
            Tekrar dene
          </button>
        </section>
      ) : champion ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-xl rounded-xl border border-neon/70 bg-deep/85 p-6 text-center shadow-glow"
        >
          <p className="eyebrow">Sampiyon</p>
          <div className="mt-5 flex justify-center">
            {mode === "players" ? <PlayerAvatar player={champion} size="lg" /> : <ClubBadge item={champion} />}
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold uppercase text-ink">
            {champion.name}
          </h2>
          {mode === "players" && <PlayerInfo item={champion} />}
          <button
            type="button"
            onClick={() => startGame(mode)}
            className="mt-6 rounded-lg border border-neon/70 bg-neon/10 px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-neon transition hover:bg-neon/15"
          >
            Tekrar Oyna
          </button>
        </motion.section>
      ) : currentPair.length === 2 ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <OptionCard
              item={currentPair[0]}
              mode={mode}
              selected={selectedId === currentPair[0].id}
              disabled={Boolean(selectedId)}
              onPick={() => pickWinner(currentPair[0])}
            />
            <div className="flex items-center justify-center">
              <span className="rounded-full border border-mid/70 bg-night px-4 py-2 font-display text-sm font-bold text-ink-muted shadow-lift">
                VS
              </span>
            </div>
            <OptionCard
              item={currentPair[1]}
              mode={mode}
              selected={selectedId === currentPair[1].id}
              disabled={Boolean(selectedId)}
              onPick={() => pickWinner(currentPair[1])}
            />
          </div>

          {history.length > 0 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {history.map((row) => (
                <section key={`${row.label}-${row.winners.length}`} className="rounded-xl border border-mid/60 bg-deep/60 p-3">
                  <p className="eyebrow">{row.label}</p>
                  <p className="mt-1 text-sm text-ink-muted">{row.winners.length} kazanan</p>
                </section>
              ))}
            </div>
          )}
        </>
      ) : (
        <section className="rounded-xl border border-mid/60 bg-deep/75 p-6 text-center">
          <p className="font-display text-xl font-bold text-ink">Bir mod secerek turnuvayi baslat.</p>
        </section>
      )}
    </motion.main>
  );
}
