import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api";
import MarketValueChart from "../components/MarketValueChart.jsx";
import PlayerAvatar from "../components/PlayerAvatar.jsx";
import { formatValue, ROLE_LABELS } from "../utils/format";

function StatTile({ label, value, tone = "text-ink" }) {
  return (
    <div className="metric-tile p-4">
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold uppercase ${tone}`}>{value}</p>
    </div>
  );
}

function shortDate(value) {
  if (!value) return "Tarih yok";
  return String(value).slice(0, 10);
}

export default function PlayerDetailPage() {
  const { playerId } = useParams();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .player(playerId)
      .then((data) => {
        if (!cancelled) setPlayer(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10">
        <div className="skeleton h-72 rounded-xl" />
      </main>
    );
  }

  if (error || !player) {
    return (
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-10">
        <p className="rounded-xl border border-ember/50 bg-deep/70 p-5 text-center text-ember">
          {error || "Oyuncu bulunamadi"}
        </p>
      </main>
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="theme-players page-shell pb-20 pt-10"
    >
      <section className="page-hero p-5 sm:p-7">
        <span className="absolute right-0 top-0 h-48 w-48 translate-x-1/3 -translate-y-1/3 rounded-full bg-neon/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <PlayerAvatar player={player} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Oyuncu Profili</p>
            <h1 className="mt-1 font-display text-4xl font-bold uppercase tracking-wide text-ink sm:text-6xl">
              {player.name}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-ink-muted">
              <span>{ROLE_LABELS[player.position] || player.position}</span>
              {player.detail_position && <span>/ {player.detail_position}</span>}
              {player.nationality && <span>/ {player.nationality}</span>}
              {player.age && <span>/ {player.age} yas</span>}
            </div>
            {player.club && (
              <Link
                to={`/kulupler/${player.club.id}`}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-void/45 px-3 py-2 text-sm font-semibold text-ink-muted transition hover:border-[var(--accent-line)] hover:text-[color-mix(in_srgb,var(--accent)_82%,white)]"
              >
                {player.club.logo_url && <img src={player.club.logo_url} alt="" className="h-5 w-5 object-contain" />}
                {player.club.name}
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Piyasa Degeri" value={formatValue(player.market_value)} tone="text-gold" />
        <StatTile label="Kayitli Gol" value={player.total_goals ?? 0} tone="text-neon" />
        <StatTile label="Kayitli Asist" value={player.total_assists ?? 0} tone="text-neon" />
        <StatTile label="Forma No" value={player.jersey_number ?? "-"} />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <MarketValueChart points={player.market_value_history} title="Deger Trendi" />

        <section className="app-panel p-5">
          <p className="eyebrow">Kupalar</p>
          {player.trophies?.length ? (
            <div className="mt-4 space-y-3">
              {player.trophies.slice(0, 8).map((trophy) => (
                <div key={trophy.id} className="rounded-lg border border-mid/50 bg-night/35 p-3">
                  <p className="font-display text-sm font-bold uppercase text-ink">{trophy.competition_name}</p>
                  <p className="mt-1 text-xs text-ink-muted">{trophy.season || "Sezon yok"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">Kayitli kupa verisi yok.</p>
          )}
        </section>
      </div>

      <section className="app-panel mt-5 p-5">
        <p className="eyebrow">Transfer Gecmisi</p>
        {player.transfers?.length ? (
          <div className="mt-4 grid gap-3">
            {player.transfers.map((transfer) => (
              <div key={transfer.id} className="grid gap-2 rounded-lg border border-mid/50 bg-night/35 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="font-display text-sm font-bold uppercase text-ink">
                    {transfer.from_club || "Bilinmiyor"} {"->"} {transfer.to_club || "Bilinmiyor"}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">{shortDate(transfer.transfer_date)}</p>
                </div>
                <span className="font-mono text-sm font-semibold text-gold">{transfer.fee || "-"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">Kayitli transfer gecmisi yok.</p>
        )}
      </section>
    </motion.main>
  );
}
