import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import CompactLeaderList from "./CompactLeaderList.jsx";
import MiniDropdown from "./MiniDropdown.jsx";

const seasonLabel = (y) => (y == null ? "" : `${y}-${String((y + 1) % 100).padStart(2, "0")}`);

/**
 * Gol/Asist krallığı paneli. Kendi lig ("Genel" = tüm ligler, her biri kendi
 * en güncel sezonuyla) + sezon seçicisini yönetir; veriyi ve competitions
 * listesini kendi metriğine (goals/assists) göre kendisi çeker.
 *
 * Sezon seçici yalnızca belirli bir lig seçiliyken anlamlı: farklı kaynaklar
 * (football-data.org 2025-26, API-Football 2024-25) farklı sezon uzayları
 * kullandığı için "Genel" görünümde tek bir global sezon dayatılmaz — her lig
 * kendi en güncel verisiyle karşılaştırılır.
 */
export default function StatLeaderPanel({ title, metric }) {
  const [leagues, setLeagues] = useState([]);
  const [leagueId, setLeagueId] = useState(null); // null = Genel
  const [season, setSeason] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .competitions({ metric })
      .then((d) => setLeagues(d.leagues || []))
      .catch(() => setLeagues([]));
  }, [metric]);

  const selectedLeague = useMemo(
    () => leagues.find((l) => l.league_id === leagueId) || null,
    [leagues, leagueId]
  );

  // Lig degisince o ligin en guncel sezonuna sifirla
  useEffect(() => {
    setSeason(selectedLeague ? selectedLeague.latest_season : null);
  }, [selectedLeague]);

  useEffect(() => {
    setLoading(true);
    const fetcher = metric === "goals" ? api.topScorers : api.topAssists;
    fetcher({
      league_id: leagueId ?? undefined,
      season: leagueId ? season ?? undefined : undefined,
      limit: 12,
    })
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [leagueId, season, metric]);

  const leagueOptions = [
    { value: null, label: "Genel" },
    ...leagues.map((l) => ({
      value: l.league_id,
      label: l.league_name,
      sublabel: seasonLabel(l.latest_season),
    })),
  ];
  const seasonOptions = (selectedLeague?.seasons || []).map((y) => ({
    value: y,
    label: seasonLabel(y),
  }));

  const items = rows.map((r) => ({
    key: `${r.source}-${r.external_player_id}-${metric}`,
    image: r.photo_url,
    round: true,
    fallback: r.name,
    title: r.name,
    subtitle: r.club_name,
    value: r[metric],
    valueClass: "text-neon",
  }));

  return (
    <section className="flex flex-col">
      <div className="mb-3">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink">{title}</h2>
        <div className="mt-2 flex items-center gap-2">
          <MiniDropdown options={leagueOptions} value={leagueId} onChange={setLeagueId} />
          {selectedLeague && seasonOptions.length > 1 && (
            <MiniDropdown options={seasonOptions} value={season} onChange={setSeason} />
          )}
        </div>
      </div>
      {loading ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : (
        <CompactLeaderList
          items={items}
          emptyText={
            metric === "assists"
              ? "Bu ligde asist verisi henüz mevcut değil."
              : "Bu lig/sezon için veri yok."
          }
        />
      )}
    </section>
  );
}
