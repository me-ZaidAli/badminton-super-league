// LOCKED palette derived from the BSL poster. Do not introduce other hues.
export const BSL = {
  bg: "hsl(222, 50%, 6%)",
  bgDeep: "hsl(222, 60%, 4%)",
  card: "hsl(222, 35%, 12%)",
  cardSoft: "hsl(222, 30%, 16%)",
  border: "hsl(222, 40%, 22%)",
  gold: "hsl(42, 95%, 55%)",
  goldDim: "hsl(42, 95%, 45%)",
  bronze: "hsl(28, 80%, 60%)",
  cyan: "hsl(195, 100%, 60%)",
  cyanDim: "hsl(195, 90%, 45%)",
  text: "hsl(0, 0%, 100%)",
  muted: "hsla(0, 0%, 100%, 0.6)",
  faint: "hsla(0, 0%, 100%, 0.35)",
  success: "hsl(142, 70%, 50%)",
  danger: "hsl(0, 80%, 60%)",
} as const;

export const BSL_GRADIENTS = {
  goldRadial: `radial-gradient(circle at 30% 30%, ${BSL.gold}, ${BSL.goldDim} 60%, transparent 80%)`,
  cyanGlow: `radial-gradient(circle at 50% 50%, ${BSL.cyan}cc, transparent 70%)`,
  cardSheen: `linear-gradient(135deg, ${BSL.cardSoft} 0%, ${BSL.card} 100%)`,
  pageWash: `radial-gradient(ellipse at top, hsla(195,100%,60%,0.18), transparent 50%), radial-gradient(ellipse at bottom, hsla(42,95%,55%,0.12), transparent 60%), ${BSL.bgDeep}`,
};
