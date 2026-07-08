const THEMES = [
  { match: ["galatasaray"], colors: ["#f2c14e", "#c8102e"] },
  { match: ["fenerbahce", "fenerbahçe"], colors: ["#f7d117", "#102b6a"] },
  { match: ["besiktas", "beşiktaş"], colors: ["#f4f4f4", "#d71920"] },
  { match: ["trabzonspor"], colors: ["#7a263a", "#68a8d8"] },
  { match: ["barcelona"], colors: ["#a50044", "#004d98"] },
  { match: ["real madrid"], colors: ["#ffffff", "#febe10"] },
  { match: ["arsenal"], colors: ["#ef0107", "#f8f8f8"] },
  { match: ["chelsea"], colors: ["#034694", "#dba111"] },
  { match: ["liverpool"], colors: ["#c8102e", "#00b2a9"] },
  { match: ["manchester city"], colors: ["#6cabdd", "#ffffff"] },
  { match: ["manchester united"], colors: ["#da291c", "#fbe122"] },
  { match: ["bayern"], colors: ["#dc052d", "#0066b2"] },
  { match: ["inter"], colors: ["#0068a8", "#111111"] },
  { match: ["milan"], colors: ["#fb090b", "#111111"] },
  { match: ["paris", "psg"], colors: ["#004170", "#da291c"] },
  { match: ["juventus"], colors: ["#f4f4f4", "#111111"] },
  { match: ["dortmund"], colors: ["#fde100", "#111111"] },
];

function normalize(value) {
  return (value || "")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function clubTheme(club) {
  const name = normalize(club?.name);
  const found = THEMES.find((theme) => theme.match.some((key) => name.includes(normalize(key))));
  if (found) return found.colors;
  const seed = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return [`hsl(${seed % 360} 78% 58%)`, `hsl(${(seed * 7) % 360} 70% 46%)`];
}

export function themeStyle(club) {
  const [primary, secondary] = clubTheme(club);
  return {
    "--club-primary": primary,
    "--club-secondary": secondary,
  };
}
