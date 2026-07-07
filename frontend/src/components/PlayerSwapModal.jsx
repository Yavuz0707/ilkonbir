import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../api";
import PlayerSearchResults from "./PlayerSearchResults.jsx";
import TrophyList from "./TrophyList.jsx";

const ROLE_ORDER = { GK: 0, DF: 1, MF: 2, FW: 3 };

/**
 * Slot'a tıklanınca açılan cam panel: "Yedekler" (aynı kadro) ve
 * "Diğer Takımlardan" (arama) sekmeleri. Arka planda saha bulanık görünür.
 */
export default function PlayerSwapModal({ open, onClose, slot, club, lineup, onSelect }) {
  const [tab, setTab] = useState("bench");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (open) {
      setTab("bench");
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Sahada olan oyuncular yedek listesinde gösterilmez
  const onPitchIds = useMemo(
    () => new Set((lineup?.slots || []).map((s) => s.player?.id).filter(Boolean)),
    [lineup]
  );

  const bench = useMemo(() => {
    const players = (club?.players || []).filter((p) => !onPitchIds.has(p.id));
    return [...players].sort(
      (a, b) =>
        (ROLE_ORDER[a.position] ?? 9) - (ROLE_ORDER[b.position] ?? 9) ||
        (b.market_value || 0) - (a.market_value || 0)
    );
  }, [club, onPitchIds]);

  // Arama: debounce'lu canlı sorgu
  useEffect(() => {
    if (tab !== "search" || query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const found = await api.searchPlayers({
          q: query.trim(),
          exclude_club_id: club?.id,
          limit: 25,
        });
        setResults(found.filter((p) => !onPitchIds.has(p.id)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, tab, club, onPitchIds]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-night/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Oyuncu değiştir"
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-mid/70 bg-deep/90 shadow-lift backdrop-blur-xl sm:rounded-2xl"
          >
            {/* Başlık */}
            <div className="flex items-center justify-between border-b border-mid/50 px-4 py-3">
              <div>
                <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink">
                  Oyuncu Değiştir
                </h2>
                <p className="text-xs text-ink-muted">
                  <span className="font-mono">{slot?.position_key}</span> —{" "}
                  {slot?.player ? slot.player.name : "Boş slot"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-mid/60 bg-night/60 text-ink-muted transition hover:text-neon"
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>

            {/* Sekmeler */}
            {slot?.player && (
              <div className="border-b border-mid/50 px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">Kupa Vitrini</p>
                    <p className="text-xs text-ink-muted">{slot.player.name}</p>
                  </div>
                </div>
                <TrophyList holderType="player" holderId={slot.player.id} compact />
              </div>
            )}

            {/* Sekmeler */}
            <div className="flex gap-1 border-b border-mid/50 px-4 pt-2">
              {[
                ["bench", "Yedekler"],
                ["search", "Diğer Takımlardan"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`relative rounded-t-lg px-4 py-2 font-display text-sm font-bold uppercase tracking-wide transition ${
                    tab === key ? "text-neon" : "text-ink-faint hover:text-ink-muted"
                  }`}
                >
                  {label}
                  {tab === key && (
                    <motion.span
                      layoutId="tab-underline"
                      className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-neon shadow-glow-sm"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* İçerik */}
            <div className="thin-scroll flex-1 overflow-y-auto">
              {tab === "bench" ? (
                <PlayerSearchResults
                  players={bench}
                  onSelect={onSelect}
                  emptyText="Kadrodaki herkes sahada — başka takımlardan oyuncu ekleyebilirsin."
                />
              ) : (
                <div>
                  <div className="sticky top-0 z-10 bg-deep/95 p-3 backdrop-blur">
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Oyuncu adı yaz (örn. Mbappé)..."
                      className="w-full rounded-lg border border-mid bg-night/80 px-3 py-2 text-sm text-ink placeholder-ink-faint outline-none transition focus:border-neon focus:shadow-glow-sm"
                    />
                  </div>
                  {searching ? (
                    <ul className="divide-y divide-mid/40" aria-label="Aranıyor">
                      {[0, 1, 2, 3].map((i) => (
                        <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                          <span className="skeleton h-9 w-9 rounded-full" />
                          <span className="flex-1 space-y-1.5">
                            <span className="skeleton block h-3 w-2/5 rounded" />
                            <span className="skeleton block h-2.5 w-1/4 rounded" />
                          </span>
                          <span className="skeleton h-3 w-12 rounded" />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <PlayerSearchResults
                      players={results}
                      onSelect={onSelect}
                      showClub
                      emptyText={
                        query.trim().length < 2
                          ? "Aramak için en az 2 harf yaz."
                          : "Bu isimde oyuncu bulamadık — farklı bir yazım dene."
                      }
                    />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
