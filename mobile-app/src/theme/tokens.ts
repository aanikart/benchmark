import { Platform } from "react-native";

/** Trail-map palette: parchment paper, pine ink, sage washes and an ochre trail marker. */
export const colors = {
  canvas: "#F2EEE5", // parchment
  surface: "#FBF9F4",
  surfaceTint: "#EEE9DE",
  text: "#26302B", // pine ink
  secondary: "#5B645E",
  accent: "#3E6A50", // pine
  accentDark: "#2A4636", // deep forest
  accentSoft: "#DCE5D6", // sage wash
  onAccent: "#FFFFFF",
  sun: "#D9B27C", // ochre trail marker
  sunSoft: "#F3E3CB",
  cautionText: "#77461A",
  cautionBg: "#F3E3CB",
  cautionStrong: "#E3BE8E",
  border: "#26302B",
  hairline: "#E0DACD",
  disabled: "#9AA39C",
  rest: "#3E6A50",
  contour: "#3B5C49", // banner topo lines
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const type = {
  hero: 34,
  title: 28,
  cardTitle: 20,
  body: 17,
  support: 15,
  caption: 13,
} as const;

export const radius = 18;
export const minTarget = 48;

/** Soft elevation instead of heavy outlines. */
export const shadow = Platform.select({
  ios: { shadowColor: "#2A3A31", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
  default: { elevation: 2 },
})!;

/** Muted per-category tiles, like coloured trail blazes (icon contrast ≥ 4.5:1). */
export const tones = {
  seat: { bg: "#DDE7D7", fg: "#3F6B45" },
  cafe: { bg: "#F1DFCF", fg: "#8A4B26" },
  art: { bg: "#E9DFE8", fg: "#6A4A6E" },
  library: { bg: "#DCE4EA", fg: "#3D5873" },
  community: { bg: "#F0DDE0", fg: "#874457" },
  garden: { bg: "#E4E8D3", fg: "#556B2F" },
  neutral: { bg: "#ECEAE3", fg: "#4A544E" },
} as const;
export type Tone = keyof typeof tones;
