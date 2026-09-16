// Categorical palette (validated: CVD Delta E >= 8, normal-vision >= 15 on
// adjacent pairs, both light/dark) — used to color-code business lines across
// Trend/Journal/Ranking. Real client codes are dynamic (not a fixed set), so
// each client gets a stable slot by its rank in the full sorted client list —
// fixed order, never re-picked when a filter changes which clients are shown.
const PALETTE = [
  { light: "#2a78d6", dark: "#3987e5" }, // blue
  { light: "#eb6834", dark: "#d95926" }, // orange
  { light: "#1baf7a", dark: "#199e70" }, // aqua
  { light: "#eda100", dark: "#c98500" }, // yellow
  { light: "#e87ba4", dark: "#d55181" }, // magenta
  { light: "#008300", dark: "#008300" }, // green
  { light: "#4a3aa7", dark: "#9085e9" }, // violet
  { light: "#e34948", dark: "#e66767" }, // red
];

export function isDarkTheme() {
  const t = document.documentElement.dataset.theme;
  if (t === "dark") return true;
  if (t === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

// `allClients` must be the full, stably-sorted list of clients the caller
// knows about — not whatever subset is currently visible/filtered.
export function makeClientColorer(allClients) {
  const sorted = [...new Set(allClients)].sort();
  const dark = isDarkTheme();
  const slotOf = new Map(sorted.map((c, i) => [c, PALETTE[i % PALETTE.length]]));
  return (client) => (slotOf.get(client) ?? PALETTE[0])[dark ? "dark" : "light"];
}
