/** Lig adı -> API-Football lig id eşlemesi (istatistik endpoint'leri için). */
export const LEAGUE_IDS = {
  "Süper Lig": 203,
  "Premier League": 39,
  "La Liga": 140,
  Bundesliga: 78,
  "Serie A": 135,
  "Ligue 1": 61,
};

export function leagueIdFor(name) {
  return LEAGUE_IDS[name] ?? null;
}
