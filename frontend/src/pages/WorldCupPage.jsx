import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api";

const TABS = [
  { key: "standings", label: "Puan Durumu" },
  { key: "fixtures", label: "Maçlar" },
  { key: "bracket", label: "Eleme Ağacı" },
  { key: "scorers", label: "Gol Krallığı" },
  { key: "assists", label: "Asist Krallığı" },
  { key: "teams", label: "Takımlar" },
  { key: "history", label: "Geçmiş Şampiyonlar" },
];

const LOADERS = {
  standings: api.worldCupStandings,
  fixtures: api.worldCupFixtures,
  bracket: api.worldCupBracket,
  scorers: api.worldCupTopScorers,
  assists: api.worldCupTopAssists,
  teams: api.worldCupTeams,
  history: api.worldCupWinners,
};

function emptyMessage(data, fallback) {
  if (!data) return fallback;
  if (data.message) return data.message;
  if (data.api_errors) return "Veri su anda alinamiyor, daha sonra tekrar deneyin.";
  return data.message || fallback;
}

function EmptyState({ children }) {
  return (
    <div className="premium-surface rounded-xl border-gold/25 p-8 text-center text-sm text-ink-muted">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gold/35 bg-gold/10 font-display text-lg font-bold text-gold">
        WC
      </div>
      <p>{children}</p>
    </div>
  );
}

function TeamLogo({ src, name }) {
  if (!src) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 font-display text-[10px] font-bold text-gold">
        {(name || "?").slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return <img src={src} alt="" className="h-6 w-6 shrink-0 object-contain" title={name} />;
}

function StatusChip({ status }) {
  const normalized = (status || "").toLowerCase();
  const live = normalized.includes("canli") || normalized.includes("live") || normalized.includes("play");
  const done = normalized.includes("bitti") || normalized.includes("finished");
  return (
    <span
      className={`rounded-full border px-2.5 py-1 font-display text-[10px] font-bold uppercase ${
        live
          ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-200"
          : done
            ? "border-gold/35 bg-gold/10 text-gold"
            : "border-sky-300/30 bg-sky-300/10 text-sky-200"
      }`}
    >
      {status || "Planlandi"}
    </span>
  );
}

function formatDateLabel(value) {
  if (!value) return "Tarih bekleniyor";
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTimeLabel(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function winnerSide(fixture) {
  if (fixture.home_goals == null || fixture.away_goals == null) return null;
  if (fixture.home_goals > fixture.away_goals) return "home";
  if (fixture.away_goals > fixture.home_goals) return "away";
  return null;
}

function LoadingGrid() {
  return (
    <div className="grid gap-3">
      <div className="skeleton h-16 rounded-xl" />
      <div className="skeleton h-16 rounded-xl" />
      <div className="skeleton h-16 rounded-xl" />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="premium-surface rounded-2xl border-gold/20 p-4 sm:p-5">
      <div className="mb-4">
        <div>
          <p className="eyebrow text-gold/80">Dunya Kupasi 2026</p>
          <h2 className="font-display text-2xl font-bold uppercase text-ink">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function Standings({ data, loading }) {
  if (loading) return <LoadingGrid />;
  if (!data?.groups?.length) {
    return <EmptyState>{emptyMessage(data, "Bu veri henuz yayinlanmadi.")}</EmptyState>;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {data.groups.map((group) => (
        <div key={group.group} className="overflow-hidden rounded-2xl border border-gold/20 bg-night/55 shadow-lift">
          <div className="flex items-center justify-between border-b border-gold/15 bg-gold/5 px-4 py-3">
            <h3 className="font-display text-sm font-bold uppercase text-gold">{group.group}</h3>
            <span className="rounded-full border border-gold/20 px-2 py-1 text-[10px] font-semibold uppercase text-ink-faint">
              Grup
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[460px] w-full text-left text-sm">
              <thead className="text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-3 py-2">Takim</th>
                  <th>O</th>
                  <th>G</th>
                  <th>B</th>
                  <th>M</th>
                  <th>AV</th>
                  <th>P</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row, index) => (
                  <tr
                    key={row.team_id || row.team_name}
                    className={`border-t border-white/10 ${index < 2 ? "bg-gold/[0.055]" : ""}`}
                  >
                    <td className="flex items-center gap-2 px-3 py-2 font-semibold text-ink">
                      <span className={`w-5 font-mono text-xs ${index < 2 ? "text-gold" : "text-ink-faint"}`}>
                        {row.rank || index + 1}
                      </span>
                      <TeamLogo src={row.team_logo} name={row.team_name} />
                      <span className="truncate">{row.team_name}</span>
                    </td>
                    <td>{row.played}</td>
                    <td>{row.won}</td>
                    <td>{row.drawn}</td>
                    <td>{row.lost}</td>
                    <td>{row.goal_difference}</td>
                    <td className="font-bold text-gold">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function Fixtures({ data, loading }) {
  const [filter, setFilter] = useState("all");
  const fixtures = data?.fixtures || [];
  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return fixtures.filter((fixture) => {
      const round = (fixture.round || "").toLowerCase();
      if (filter === "group") return round.includes("group");
      if (filter === "knockout") return fixture.round && !round.includes("group");
      if (filter === "today") return (fixture.date || "").slice(0, 10) === today;
      return true;
    });
  }, [filter, fixtures]);
  const grouped = useMemo(() => {
    return filtered.reduce((acc, fixture) => {
      const key = formatDateLabel(fixture.date);
      acc[key] = acc[key] || [];
      acc[key].push(fixture);
      return acc;
    }, {});
  }, [filtered]);

  if (loading) return <LoadingGrid />;
  if (!fixtures.length) {
    return <EmptyState>{emptyMessage(data, "Bu veri henuz yayinlanmadi.")}</EmptyState>;
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          ["all", "Tum maclar"],
          ["group", "Grup"],
          ["knockout", "Eleme"],
          ["today", "Bugun"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-lg border px-3 py-1.5 font-display text-xs font-bold uppercase transition ${
              filter === key ? "border-gold bg-gold/10 text-gold" : "border-white/10 bg-deep/65 text-ink-muted hover:border-gold/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {filtered.length ? (
        <div className="grid gap-5">
          {Object.entries(grouped).map(([date, rows]) => (
            <section key={date}>
              <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-gold">
                {date}
              </h3>
              <div className="grid gap-3">
                {rows.map((fixture) => (
                  <MatchCard key={fixture.id || `${fixture.home_team}-${fixture.away_team}-${fixture.date}`} fixture={fixture} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState>Bu filtre icin mac bulunmuyor.</EmptyState>
      )}
    </div>
  );
}

function MatchCard({ fixture }) {
  const winner = winnerSide(fixture);
  return (
    <article className="rounded-2xl border border-white/10 bg-night/55 p-4 shadow-lift">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 font-display text-[10px] font-bold uppercase text-gold">
            {fixture.round || "Turnuva"}
          </span>
          <span className="text-xs text-ink-faint">{formatTimeLabel(fixture.date)}</span>
        </div>
        <StatusChip status={fixture.status} />
      </div>
      <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <TeamName
          name={fixture.home_team}
          logo={fixture.home_logo}
          active={winner === "home"}
          align="left"
        />
        <div className="mx-auto min-w-24 rounded-xl border border-gold/25 bg-gold/10 px-4 py-2 text-center font-display text-2xl font-bold text-gold">
          {fixture.home_goals ?? "-"} : {fixture.away_goals ?? "-"}
        </div>
        <TeamName
          name={fixture.away_team}
          logo={fixture.away_logo}
          active={winner === "away"}
          align="right"
        />
      </div>
    </article>
  );
}

function TeamName({ name, logo, active, align }) {
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "justify-end sm:flex-row-reverse" : ""}`}>
      <TeamLogo src={logo} name={name} />
      <span className={`truncate font-display text-base font-bold uppercase ${active ? "text-gold" : "text-ink"}`}>
        {name || "-"}
      </span>
    </div>
  );
}

function Bracket({ data, loading }) {
  if (loading) return <LoadingGrid />;
  if (!data?.rounds?.length) {
    return <EmptyState>{emptyMessage(data, "Turnuva ilerledikce burada gorunecek.")}</EmptyState>;
  }
  const champion = findChampion(data.rounds);
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[980px] grid-cols-[repeat(4,minmax(210px,1fr))_220px] gap-4">
        {data.rounds.map((round) => (
          <div key={round.name} className="rounded-2xl border border-gold/20 bg-night/55 p-3">
            <h3 className="mb-3 font-display text-sm font-bold uppercase text-gold">{round.name}</h3>
            <div className="grid gap-3">
              {round.fixtures.map((fixture) => (
                <BracketMatch key={fixture.id || `${fixture.home_team}-${fixture.away_team}`} fixture={fixture} />
              ))}
            </div>
          </div>
        ))}
        <div className="flex min-h-full flex-col justify-center rounded-2xl border border-gold/35 bg-gold/10 p-4 text-center shadow-[0_0_28px_rgba(246,200,95,0.14)]">
          <p className="eyebrow text-gold/80">Sampiyon</p>
          <div className="mx-auto my-4 flex h-16 w-16 items-center justify-center rounded-full border border-gold/40 bg-night/45 font-display text-2xl font-bold text-gold">
            WC
          </div>
          <h3 className="font-display text-xl font-bold uppercase text-ink">
            {champion || "Turnuva ilerledikce"}
          </h3>
        </div>
      </div>
    </div>
  );
}

function BracketMatch({ fixture }) {
  const winner = winnerSide(fixture);
  return (
    <article className="relative rounded-xl border border-white/10 bg-deep/72 p-3 text-sm">
      <span className="absolute -right-4 top-1/2 hidden h-px w-4 bg-gold/25 xl:block" aria-hidden="true" />
      <BracketTeam
        name={fixture.home_team}
        logo={fixture.home_logo}
        score={fixture.home_goals}
        active={winner === "home"}
      />
      <div className="my-2 border-t border-white/10" />
      <BracketTeam
        name={fixture.away_team}
        logo={fixture.away_logo}
        score={fixture.away_goals}
        active={winner === "away"}
      />
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-ink-faint">
        <span>{fixture.date ? new Date(fixture.date).toLocaleDateString("tr-TR") : "Tarih bekleniyor"}</span>
        <StatusChip status={fixture.status_short || fixture.status} />
      </div>
    </article>
  );
}

function BracketTeam({ name, logo, score, active }) {
  return (
    <div className={`flex items-center gap-2 ${active ? "text-gold" : "text-ink-muted"}`}>
      <TeamLogo src={logo} name={name} />
      <span className="min-w-0 flex-1 truncate font-semibold">{name || "Bekleniyor"}</span>
      <span className="font-display text-base font-bold">{score ?? "-"}</span>
    </div>
  );
}

function findChampion(rounds) {
  const finalRound = [...rounds].reverse().find((round) => /final/i.test(round.name));
  const final = finalRound?.fixtures?.find((fixture) => winnerSide(fixture));
  if (!final) return null;
  return winnerSide(final) === "home" ? final.home_team : final.away_team;
}

function Leaders({ data, loading, metric }) {
  if (loading) return <LoadingGrid />;
  if (!data?.players?.length) {
    return <EmptyState>{emptyMessage(data, "Turnuva ilerledikce burada gorunecek.")}</EmptyState>;
  }
  const top = data.players.slice(0, 3);
  const rest = data.players.slice(3);
  const metricLabel = metric === "assists" ? "Asist" : "Gol";
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-3">
        {top.map((player, index) => (
          <LeaderPodiumCard
            key={player.player_id || player.name}
            player={player}
            rank={index + 1}
            metric={metric}
            metricLabel={metricLabel}
          />
        ))}
      </div>
      {rest.length > 0 && (
        <div className="grid gap-2">
          {rest.map((player, index) => (
            <LeaderRow
              key={player.player_id || player.name}
              player={player}
              rank={index + 4}
              metric={metric}
              metricLabel={metricLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerPhoto({ player, size = "md" }) {
  const classes = size === "lg" ? "h-16 w-16" : "h-11 w-11";
  if (player.photo_url) {
    return <img src={player.photo_url} alt="" className={`${classes} rounded-full object-cover ring-2 ring-gold/35`} />;
  }
  return (
    <div className={`${classes} flex items-center justify-center rounded-full border border-gold/25 bg-gold/10 font-display text-sm font-bold text-gold`}>
      {(player.name || "?").slice(0, 2).toUpperCase()}
    </div>
  );
}

function LeaderPodiumCard({ player, rank, metric, metricLabel }) {
  const value = metric === "assists" ? player.assists : player.goals;
  const rankTone = rank === 1 ? "border-gold/40 bg-gold/10" : rank === 2 ? "border-sky-300/25 bg-sky-300/8" : "border-orange-300/25 bg-orange-300/8";
  return (
    <article className={`rounded-2xl border ${rankTone} p-4 shadow-lift`}>
      <div className="mb-4 flex items-center justify-between">
        <span className="font-display text-3xl font-bold text-gold">#{rank}</span>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase text-ink-faint">
          {player.appearances ? `${player.appearances} mac` : metricLabel}
        </span>
      </div>
      <PlayerPhoto player={player} size="lg" />
      <h3 className="mt-3 truncate font-display text-xl font-bold uppercase text-ink">{player.name}</h3>
      <p className="truncate text-sm text-ink-muted">{player.team_name || "-"}</p>
      <p className="mt-4 font-display text-4xl font-bold text-gold">{value}</p>
      <p className="eyebrow">{metricLabel}</p>
    </article>
  );
}

function LeaderRow({ player, rank, metric, metricLabel }) {
  const value = metric === "assists" ? player.assists : player.goals;
  return (
    <article className="flex items-center gap-3 rounded-xl border border-white/10 bg-night/55 p-3">
      <span className="w-8 font-display text-lg font-bold text-gold">{rank}</span>
      <PlayerPhoto player={player} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{player.name}</p>
        <p className="truncate text-xs text-ink-muted">
          {player.team_name || "-"} {player.appearances ? `- ${player.appearances} mac` : ""}
        </p>
      </div>
      <span className="rounded-lg border border-gold/20 bg-gold/10 px-3 py-1 font-display text-xl font-bold text-gold">
        {value}
      </span>
      <span className="hidden text-xs text-ink-faint sm:block">{metricLabel}</span>
    </article>
  );
}

function Teams({ data, loading }) {
  if (loading) return <LoadingGrid />;
  if (!data?.teams?.length) {
    return <EmptyState>{emptyMessage(data, "Bu veri henuz yayinlanmadi.")}</EmptyState>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {data.teams.map((team) => (
        <div key={team.id || team.name} className="rounded-2xl border border-white/10 bg-night/55 p-4 shadow-lift">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10">
            <TeamLogo src={team.logo_url} name={team.name} />
          </div>
          <div>
            <p className="font-display text-lg font-bold uppercase text-ink">{team.name}</p>
            <p className="text-xs text-ink-muted">{team.code || team.country || "Dunya Kupasi"}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function History({ data, loading }) {
  if (loading) return <LoadingGrid />;
  const rows = data || [];
  const featured = rows.slice(-3).reverse();
  const eras = [
    ["1930-1970", rows.filter((row) => row.year <= 1970)],
    ["1974-2002", rows.filter((row) => row.year >= 1974 && row.year <= 2002)],
    ["2006-2022", rows.filter((row) => row.year >= 2006)],
  ].filter(([, items]) => items.length);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 md:grid-cols-3">
        {featured.map((row) => (
          <article key={row.year} className="rounded-2xl border border-gold/25 bg-gold/10 p-4 shadow-lift">
            <p className="eyebrow text-gold/80">{row.year}</p>
            <h3 className="mt-2 font-display text-2xl font-bold uppercase text-ink">{row.champion}</h3>
            <p className="mt-1 text-sm text-ink-muted">{row.host_country} ev sahipligi</p>
            <div className="mt-4 rounded-xl border border-white/10 bg-night/45 p-3 text-sm">
              <p className="text-ink-muted">Finalist: <span className="text-ink">{row.runner_up}</span></p>
              <p className="text-ink-muted">Skor: <span className="text-gold">{row.final_score || "Belirtilmedi"}</span></p>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-5">
        {eras.map(([label, items]) => (
          <section key={label} className="rounded-2xl border border-white/10 bg-night/45 p-4">
            <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-gold">
              {label}
            </h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((row) => (
                <HistoryCard key={row.year} row={row} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function HistoryCard({ row }) {
  return (
    <article className="relative rounded-xl border border-white/10 bg-deep/70 p-4">
      <span className="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-gold/40 via-gold/10 to-transparent" aria-hidden="true" />
      <div className="pl-5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-2xl font-bold text-gold">{row.year}</span>
          <span className="rounded-full border border-gold/20 bg-gold/10 px-2 py-1 text-[10px] uppercase text-gold">
            Sampiyon
          </span>
        </div>
        <h4 className="mt-2 font-display text-lg font-bold uppercase text-ink">{row.champion}</h4>
        <p className="text-sm text-ink-muted">{row.host_country}</p>
        <div className="mt-3 grid gap-1 text-sm">
          <p className="text-ink-muted">Finalist: <span className="text-ink">{row.runner_up}</span></p>
          <p className="text-ink-muted">Final: <span className="text-gold">{row.final_score || "Belirtilmedi"}</span></p>
          <p className="text-ink-muted">
            Gol krali: <span className="text-ink">{row.top_scorer ? `${row.top_scorer} (${row.top_scorer_goals})` : "Kayit yok"}</span>
          </p>
        </div>
      </div>
    </article>
  );
}

export default function WorldCupPage() {
  const [active, setActive] = useState("history");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState({});

  const loadSection = useCallback(async (key, force = false) => {
    if (!LOADERS[key] || (!force && (data[key] || loading[key]))) return;
    setLoading((state) => ({ ...state, [key]: true }));
    setError((state) => ({ ...state, [key]: null }));
    try {
      const result = await LOADERS[key]();
      setData((state) => ({ ...state, [key]: result }));
    } catch (e) {
      setError((state) => ({ ...state, [key]: e.message || "Veri yuklenemedi" }));
    } finally {
      setLoading((state) => ({ ...state, [key]: false }));
    }
  }, [data, loading]);

  useEffect(() => {
    loadSection(active);
  }, [active, loadSection]);

  const activeError = error[active];

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="theme-worldcup page-shell pb-12 pt-8"
    >
      <header className="page-hero mb-6 px-5 py-8">
        <span className="motif-lines" aria-hidden="true" />
        <div>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-gold/35 bg-gold/10 font-display text-xl font-black text-gold shadow-[0_0_24px_rgba(214,180,95,0.16)]">
            WC
          </div>
          <p className="eyebrow text-gold/80">Ilk Onbir Turnuva Merkezi</p>
          <h1 className="mt-1 font-display text-5xl font-black uppercase tracking-wide text-ink sm:text-7xl">
            Dunya <span className="text-gold">Kupasi</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
            Gruplar, maclar, eleme agaci ve tarihi sampiyonlar tek prestijli turnuva panelinde.
          </p>
          <div className="mt-5 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              ["48", "Takim"],
              ["104", "Mac"],
              ["12", "Grup"],
            ].map(([value, label]) => (
              <div key={label} className="metric-tile px-4 py-3">
                <p className="font-display text-2xl font-black text-gold">{value}</p>
                <p className="eyebrow">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`rounded-lg border px-3 py-2 font-display text-xs font-bold uppercase tracking-wide transition sm:text-sm ${
              active === tab.key
                ? "premium-tab-active"
                : "premium-tab hover:border-gold/40 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeError ? (
        <section className="rounded-xl border border-ember/50 bg-deep/75 p-6 text-center">
          <p className="font-display text-xl font-bold text-ember">{activeError}</p>
          <button
            type="button"
            onClick={() => loadSection(active, true)}
            className="mt-4 rounded-lg border border-neon/70 px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-neon"
          >
            Tekrar dene
          </button>
        </section>
      ) : active === "standings" ? (
        <Section title="Puan Durumu">
          <Standings data={data.standings} loading={loading.standings} />
        </Section>
      ) : active === "fixtures" ? (
        <Section title="Maclar ve Sonuclar">
          <Fixtures data={data.fixtures} loading={loading.fixtures} />
        </Section>
      ) : active === "bracket" ? (
        <Section title="Eleme Agaci">
          <Bracket data={data.bracket} loading={loading.bracket} />
        </Section>
      ) : active === "scorers" ? (
        <Section title="Gol Kralligi">
          <Leaders data={data.scorers} loading={loading.scorers} metric="goals" />
        </Section>
      ) : active === "assists" ? (
        <Section title="Asist Kralligi">
          <Leaders data={data.assists} loading={loading.assists} metric="assists" />
        </Section>
      ) : active === "teams" ? (
        <Section title="Takimlar">
          <Teams data={data.teams} loading={loading.teams} />
        </Section>
      ) : (
        <Section title="Gecmis Sampiyonlar">
          <History data={data.history} loading={loading.history} />
        </Section>
      )}
    </motion.main>
  );
}
