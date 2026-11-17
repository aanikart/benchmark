import { Platform } from "react-native";

export const colors = {
  canvas: "#FBF7EF",
  surface: "#FFFFFF",
  surfaceTint: "#F6F2EA",
  text: "#14231F",
  secondary: "#4F5D58",
  accent: "#13804F",
  accentDark: "#0B4F33",
  accentSoft: "#D9F2E4",
  sun: "#FFB627",
  sunSoft: "#FFF0CC",
  onAccent: "#FFFFFF",
  cautionText: "#765114",
  cautionBg: "#FFF1CF",
  cautionStrong: "#FFB627",
  border: "#182A27",
  hairline: "#E4E0D7",
  disabled: "#9AA39F",
  rest: "#246B54",
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
  ios: { shadowColor: "#1A2A26", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  default: { elevation: 2 },
})!;

/** Per-category tile colors so place types are recognisable at a glance (text/icon contrast ≥ 4.5:1). */
export const tones = {
  seat: { bg: "#D9F2E4", fg: "#0B6B3F" },
  cafe: { bg: "#FFE6D1", fg: "#9A3F08" },
  art: { bg: "#F1E1FA", fg: "#6E2A87" },
  library: { bg: "#DCE9FF", fg: "#1C4A99" },
  community: { bg: "#FFE0EA", fg: "#9C1F4B" },
  garden: { bg: "#E3F4D2", fg: "#3A6A10" },
  neutral: { bg: "#EEF0EC", fg: "#3E4B47" },
} as const;
export type Tone = keyof typeof tones;
