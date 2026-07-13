import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../api";
import BenchList from "../components/BenchList.jsx";
import ClubHeader from "../components/ClubHeader.jsx";
import FormationSelector from "../components/FormationSelector.jsx";
import PitchBackground from "../components/PitchBackground.jsx";
import PlayerSlot from "../components/PlayerSlot.jsx";
import PlayerSwapModal from "../components/PlayerSwapModal.jsx";
import SquadValueBar from "../components/SquadValueBar.jsx";
import { themeStyle } from "../utils/clubTheme";

// Skeleton'da nabız atan slot yer tutucuları (4-3-3 koordinatları)
const SKELETON_SPOTS = [
  [50, 88], [14, 68], [37, 73], [63, 73], [86, 68],
  [27, 47], [50, 54], [73, 47], [16, 24], [50, 17], [84, 24],
];

/** Saha ekranı: gerçek ilk onbir + oyuncu/formasyon değiştirme. */
export default function LineupBuilderPage() {
  const { clubId } = useParams();
  const [club, setClub] = useState(null);
  const [formations, setFormations] = useState([]);
  const [lineup, setLineup] = useState(null);
  const [selectedSlotKey, setSelectedSlotKey] = useState(null);
  const [placingPlayer, setPlacingPlayer] = useState(null); // yedekten yerleştirme modu
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [clubData, formationList] = await Promise.all([
          api.club(clubId),
          api.formations(),
        ]);
        const storageKey = `ilkonbir-lineup-${clubId}`;
        let lineupData = null;
        const savedId = sessionStorage.getItem(storageKey);
        if (savedId) {
          lineupData = await api.lineup(savedId).catch(() => null);
        }
        if (!lineupData) {
          lineupData = await api.createLineup(Number(clubId));
          sessionStorage.setItem(storageKey, String(lineupData.id));
        }
        if (!cancelled) {
          setClub(clubData);
          setFormations(formationList);
          setLineup(lineupData);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const positionByKey = useMemo(() => {
    const map = {};
    lineup?.formation.position_slots.forEach((s) => (map[s.key] = s));
    return map;
  }, [lineup]);

  const totalValue = useMemo(
    () => (lineup?.slots || []).reduce((sum, s) => sum + (s.player?.market_value || 0), 0),
    [lineup]
  );

  const showError = useCallback((message) => {
    setError(message);
    setTimeout(() => setError(null), 4000);
  }, []);

  // Ortak yerleştirme: optimistic güncelle, PATCH, hata olursa geri al
  const placeInSlot = useCallback(
    async (player, slotKey) => {
      if (!lineup) return;
      const previous = lineup;
      const optimisticSlots = lineup.slots.map((s) => {
        if (s.position_key === slotKey) return { ...s, player };
        if (s.player?.id === player.id) {
          const old = lineup.slots.find((x) => x.position_key === slotKey);
          return { ...s, player: old?.player ?? null };
        }
        return s;
      });
      setLineup({ ...lineup, slots: optimisticSlots });

      try {
        const updated = await api.changeSlotPlayer(lineup.id, slotKey, player.id);
        setLineup(updated);
      } catch (e) {
        setLineup(previous);
        showError(`Oyuncu değiştirilemedi: ${e.message}`);
      }
    },
    [lineup, showError]
  );

  // Modaldan seçim
  const handleModalSelect = useCallback(
    (player) => {
      const slotKey = selectedSlotKey;
      setSelectedSlotKey(null);
      if (slotKey) placeInSlot(player, slotKey);
    },
    [selectedSlotKey, placeInSlot]
  );

  // Sahadaki slota tıklama: yerleştirme modundaysa oraya koy, değilse modal aç
  const handleSlotClick = useCallback(
    (slotKey) => {
      if (placingPlayer) {
        placeInSlot(placingPlayer, slotKey);
        setPlacingPlayer(null);
      } else {
        setSelectedSlotKey(slotKey);
      }
    },
    [placingPlayer, placeInSlot]
  );

  const handleFormationChange = useCallback(
    async (formationId) => {
      if (!lineup || formationId === lineup.formation.id) return;
      setSaving(true);
      try {
        const updated = await api.changeFormation(lineup.id, formationId);
        setLineup(updated);
      } catch (e) {
        showError(`Formasyon değiştirilemedi: ${e.message}`);
      } finally {
        setSaving(false);
      }
    },
    [lineup, showError]
  );

  if (loading) {
    return (
      <div className="mx-auto min-h-screen max-w-6xl px-4 pb-28 pt-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div
            className="skeleton relative mx-auto h-[min(80vh,860px)] w-full max-w-lg rounded-2xl"
            style={{ aspectRatio: "68 / 105" }}
            aria-label="Kadro yükleniyor"
          >
            {SKELETON_SPOTS.map(([x, y], i) => (
              <span
                key={i}
                className="absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mid/50"
                style={{ left: `${x}%`, top: `${y}%` }}
              />
            ))}
          </div>
          <div className="space-y-4">
            <span className="skeleton block h-20 w-full rounded-xl" />
            <span className="skeleton block h-12 w-full rounded-lg" />
            <span className="skeleton block h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!club || !lineup) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-ember">{error || "Kadro yüklenemedi."}</p>
        <a href="/" className="text-sm text-neon underline">
          Kulüp seçimine dön
        </a>
      </div>
    );
  }

  const selectedSlot = lineup.slots.find((s) => s.position_key === selectedSlotKey);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={themeStyle(club)}
      className="mx-auto min-h-screen max-w-7xl px-4 pb-32 pt-6"
    >
      <span
        className="pointer-events-none fixed left-[-12%] top-16 h-[420px] w-[420px] rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--club-primary)" }}
      />
      <span
        className="pointer-events-none fixed right-[-12%] bottom-0 h-[360px] w-[360px] rounded-full opacity-[0.18] blur-3xl"
        style={{ background: "var(--club-secondary)" }}
      />
      {/* Hata bildirimi */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            role="alert"
            className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-lg border border-ember/50 bg-night/90 px-4 py-2 text-sm text-ember backdrop-blur"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,720px)_340px] lg:grid-rows-[auto_minmax(0,1fr)] lg:justify-center lg:gap-6">
        {/* Saha — masaüstünde solda, iki satırı kaplar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative order-2 mx-auto w-full max-w-lg lg:order-none lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:w-[min(31vw,470px)] lg:max-w-full"
          style={{ aspectRatio: "68 / 105" }}
        >
          <PitchBackground />
          {lineup.slots.map((slot) => {
            const pos = positionByKey[slot.position_key];
            if (!pos) return null;
            const compatible = !placingPlayer || pos.role === placingPlayer.position;
            return (
              <PlayerSlot
                key={slot.player ? `p-${slot.player.id}` : `s-${slot.position_key}`}
                slot={slot}
                position={pos}
                isSelected={selectedSlotKey === slot.position_key}
                highlight={placingPlayer != null && compatible}
                dimmed={placingPlayer != null && !compatible}
                onClick={() => handleSlotClick(slot.position_key)}
              />
            );
          })}

          {/* Yerleştirme modu afişi */}
          <AnimatePresence>
            {placingPlayer && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-2 rounded-lg border border-neon/50 bg-night/90 px-3 py-2 backdrop-blur"
              >
                <span className="text-xs text-ink">
                  <span className="font-semibold text-neon">{placingPlayer.name}</span> için bir
                  pozisyona dokun
                </span>
                <button
                  onClick={() => setPlacingPlayer(null)}
                  className="rounded px-2 py-0.5 font-display text-xs font-bold text-ink-muted transition hover:text-neon"
                >
                  Vazgeç
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Rail üst: kulüp kimliği + formasyon */}
        <div className="order-1 space-y-5 lg:order-none lg:col-start-2 lg:row-start-1 lg:min-h-0">
          <ClubHeader club={club} />
          <FormationSelector
            formations={formations}
            value={lineup.formation.id}
            onChange={handleFormationChange}
            disabled={saving}
          />
        </div>

        {/* Rail alt: yedek kadro */}
        <div className="order-3 min-h-0 lg:order-none lg:col-start-2 lg:row-start-2">
          <BenchList
            club={club}
            lineup={lineup}
            onPickPlayer={(p) => setPlacingPlayer((cur) => (cur?.id === p.id ? null : p))}
            activePlayerId={placingPlayer?.id}
          />
        </div>
      </div>

      <PlayerSwapModal
        open={selectedSlotKey != null}
        onClose={() => setSelectedSlotKey(null)}
        slot={selectedSlot}
        club={club}
        lineup={lineup}
        onSelect={handleModalSelect}
      />

      <SquadValueBar totalValue={totalValue} />
    </motion.main>
  );
}
