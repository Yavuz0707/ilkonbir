import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api";
import MarketValueChart from "../components/MarketValueChart.jsx";
import PlayerAvatar from "../components/PlayerAvatar.jsx";
import { formatValue, ROLE_LABELS, initials } from "../utils/format";
import { themeStyle } from "../utils/clubTheme";

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

export default function ClubStatsPage() {
  const { clubId } = useParams();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .clubStats(clubId)
      .then((data) => {
        if (!cancelled) setStats(data);
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
  }, [clubId]);

  const club = stats?.club;
  const topPlayers = useMemo(() => stats?.top_players ?? [], [stats]);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10">
        <div className="skeleton h-72 rounded-xl" />
      </main>
    );
  }

  if (error || !stats || !club) {
    return (
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-10">
        <p className="rounded-xl border border-ember/50 bg-deep/70 p-5 text-center text-ember">
          {error || "Kulup bulunamadi"}
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
      style={themeStyle(club)}
      className="theme-clubs page-shell relative overflow-hidden pb-20 pt-10"
    >
      <span
        className="pointer-events-none fixed left-[-10%] top-20 h-80 w-80 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--club-primary)" }}
      />
      <span
        className="pointer-events-none fixed right-[-8%] top-36 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--club-secondary)" }}
      />

      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-panel/70 shadow-lift">
        <div
          className="h-1.5 w-full"
          style={{ background: "linear-gradient(90deg, var(--club-primary), var(--club-secondary), var(--accent))" }}
          aria-hidden="true"
        />
        <div className="grid gap-5 px-5 py-6 sm:grid-cols-[116px_minmax(0,1fr)_auto] sm:items-center sm:px-7 sm:py-7">
          <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-white/10 bg-night/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            {club.logo_url ? (
              <img src={club.logo_url} alt="" className="h-full w-full object-contain" />
            ) : (
              <span className="font-display text-2xl font-bold text-ink">{initials(club.name)}</span>
            )}
          </div>

          <div className="min-w-0">
            <p className="eyebrow">{club.league || "Kulüp"}</p>
            <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none tracking-normal text-ink sm:text-6xl">
              {club.name}
            </h1>
            <p className="mt-4 text-sm text-ink-muted">
              {club.country || "Ülke yok"} {club.coach ? `- Teknik direktör: ${club.coach.name}` : ""}
            </p>
          </div>

          <Link
            to={`/club/${club.id}`}
            className="w-full rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] px-5 py-3 text-center font-mono text-xs font-bold uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--accent)_82%,white)] shadow-glow-sm transition hover:bg-white/[0.06] sm:w-auto"
          >
            Saha Ekranı
          </Link>
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Kadro Değeri" value={formatValue(stats.total_market_value)} tone="text-gold" />
        <StatTile label="Ortalama Değer" value={formatValue(stats.average_market_value)} />
        <StatTile label="Oyuncu" value={stats.player_count} tone="text-neon" />
        <StatTile label="Lig" value={club.league || "-"} />
      </section>

      <section className="app-panel mt-5 p-5">
        <p className="eyebrow">Kulüp Kaydı</p>
        <div className="mt-4 grid gap-3 text-sm text-ink-muted sm:grid-cols-2 lg:grid-cols-4">
          <p>
            <span className="block font-display text-xs font-bold uppercase tracking-wide text-ink-faint">Ülke</span>
            {club.country || "-"}
          </p>
          <p>
            <span className="block font-display text-xs font-bold uppercase tracking-wide text-ink-faint">Lig</span>
            {club.league || "-"}
          </p>
          <p>
            <span className="block font-display text-xs font-bold uppercase tracking-wide text-ink-faint">Teknik Ekip</span>
            {club.coach?.name || "-"}
          </p>
          <p>
            <span className="block font-display text-xs font-bold uppercase tracking-wide text-ink-faint">Kadro</span>
            {stats.player_count} oyuncu
          </p>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <MarketValueChart points={stats.market_value_history} title="Kadro Değeri Trendi" />

        <section className="app-panel p-5">
          <p className="eyebrow">En Değerli Oyuncular</p>
          <div className="mt-4 space-y-3">
            {topPlayers.map((player) => (
              <Link
                key={player.id}
                to={`/oyuncular/${player.id}`}
                className="flex items-center gap-3 rounded-lg border border-mid/50 bg-night/35 p-3 transition hover:border-neon/50"
              >
                <PlayerAvatar player={player} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold uppercase text-ink">{player.name}</p>
                  <p className="mt-1 text-xs text-ink-muted">{ROLE_LABELS[player.position] || player.position}</p>
                </div>
                <span className="font-mono text-sm font-semibold text-gold">{formatValue(player.market_value)}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="app-panel mt-5 p-5">
        <p className="eyebrow">Son Transferler</p>
        {stats.transfers?.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {stats.transfers.slice(0, 12).map((transfer) => (
              <div key={transfer.id} className="rounded-lg border border-mid/50 bg-night/35 p-3">
                <p className="font-display text-sm font-bold uppercase text-ink">
                  {transfer.player_name}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {transfer.from_club || "Bilinmiyor"} {"->"} {transfer.to_club || "Bilinmiyor"}
                </p>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                  <span className="text-ink-faint">{shortDate(transfer.transfer_date)}</span>
                  <span className="font-mono font-semibold text-gold">{transfer.fee || "-"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">Kayıtlı transfer verisi yok.</p>
        )}
      </section>
    </motion.main>
  );
}
