// Slate / blue dashboard palette for the BSL Club Dashboard + Player Stats
// modals. Matches the reference design (dark blue/black, blue accent, green
// wins, red losses). Used ONLY by the stats dashboards — the rest of the BSL
// module keeps its locked cyan/gold poster palette.
export const DASH = {
  bg: "#0f172a",
  bgAlt: "#121826",
  panel: "#1e293b",
  card: "#273042",
  cardAlt: "#334155",
  border: "rgba(148,163,184,0.18)",
  borderStrong: "rgba(148,163,184,0.32)",
  accent: "#3b82f6",
  accentStrong: "#2563eb",
  win: "#10b981",
  loss: "#ef4444",
  neutral: "#94a3b8",
  text: "#f1f5f9",
  textDim: "#cbd5e1",
  muted: "#94a3b8",
  gold: "#fbbf24",
  silver: "#cbd5e1",
  bronze: "#d97706",
} as const;
