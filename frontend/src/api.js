const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `İstek başarısız (${res.status})`);
  }
  return res.json();
}

export const api = {
  clubs: (params = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    );
    const qs = q.toString();
    return request(`/clubs${qs ? `?${qs}` : ""}`);
  },
  club: (id) => request(`/clubs/${id}`),
  clubStats: (id) => request(`/clubs/${id}/stats`),
  formations: () => request("/formations"),
  createLineup: (clubId, formationId = null) =>
    request("/lineups", {
      method: "POST",
      body: JSON.stringify({ club_id: clubId, formation_id: formationId }),
    }),
  lineup: (id) => request(`/lineups/${id}`),
  changeFormation: (lineupId, formationId) =>
    request(`/lineups/${lineupId}/formation`, {
      method: "PATCH",
      body: JSON.stringify({ formation_id: formationId }),
    }),
  changeSlotPlayer: (lineupId, slotKey, playerId) =>
    request(`/lineups/${lineupId}/slots/${slotKey}`, {
      method: "PATCH",
      body: JSON.stringify({ player_id: playerId }),
    }),
  summary: (lineupId) => request(`/lineups/${lineupId}/summary`),
  searchPlayers: (params = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    );
    return request(`/players/search?${q}`);
  },
  player: (id) => request(`/players/${id}`),
  competitions: (params = {}) => request(`/stats/competitions?${qs(params)}`),
  topScorers: (params = {}) => request(`/stats/top-scorers?${qs(params)}`),
  topAssists: (params = {}) => request(`/stats/top-assists?${qs(params)}`),
  mostValuableClubs: (params = {}) => request(`/stats/most-valuable-clubs?${qs(params)}`),
  mostValuablePlayers: (params = {}) => request(`/stats/most-valuable-players?${qs(params)}`),
  higherLowerNext: (params = {}) => request(`/games/higher-lower/next?${qs(params)}`),
  logoQuizNext: (params = {}) => request(`/games/logo-quiz/next?${qs(params)}`),
  silhouetteNext: (params = {}) => request(`/games/silhouette/next?${qs(params)}`),
  clueGuessNext: () => request("/games/clue-guess/next"),
  clueGuessAnswer: (payload) =>
    request("/games/clue-guess/answer", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  transferRouteNext: () => request("/games/transfer-route/next"),
  tournamentSuperligClubs: (params = {}) =>
    request(`/games/tournament/superlig-clubs?${qs(params)}`),
  tournamentPlayers: (params = {}) => request(`/games/tournament/players?${qs(params)}`),
  worldCupStandings: () => request("/world-cup/2026/standings"),
  worldCupFixtures: () => request("/world-cup/2026/fixtures"),
  worldCupRounds: () => request("/world-cup/2026/rounds"),
  worldCupBracket: () => request("/world-cup/2026/bracket"),
  worldCupTopScorers: () => request("/world-cup/2026/top-scorers"),
  worldCupTopAssists: () => request("/world-cup/2026/top-assists"),
  worldCupTeams: () => request("/world-cup/2026/teams"),
  worldCupWinners: () => request("/world-cup/history/winners"),
  playerTrophies: (playerId) => request(`/players/${playerId}/trophies`),
  coachTrophies: (coachId) => request(`/clubs/coaches/${coachId}/trophies`),
};

function qs(params) {
  return new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== "")
  ).toString();
}
