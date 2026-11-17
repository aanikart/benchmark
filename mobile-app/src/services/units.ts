// Display units follow the wireframes (feet). All calculations stay in unrounded metres.
export const M_PER_FT = 0.3048;
export const ftToM = (ft: number) => ft * M_PER_FT;
export const mToFt = (m: number) => m / M_PER_FT;

/** Rounded for display only; comparisons never use this. */
export function fmtFt(m: number): string {
  const ft = mToFt(m);
  const rounded = ft >= 1000 ? Math.round(ft / 10) * 10 : Math.round(ft);
  return `${rounded.toLocaleString("en-US")} ft`;
}

export const LIMIT_STEP_FT = 50;
export const LIMIT_MIN_FT = 200; // ≈ 61 m (plan range 50–1,000 m)
export const LIMIT_MAX_FT = 3250; // ≈ 991 m
export const LIMIT_DEFAULT_FT = 300;

/** Rough time at a relaxed pace (~220 ft/min). An illustration, not a prediction. */
export function walkMinutes(m: number) {
  return Math.max(1, Math.round(mToFt(m) / 220));
}

export function limitHelper(ft: number) {
  const lo = Math.max(1, Math.round(ft / 264));
  const hi = Math.max(lo, Math.round(ft / 150));
  return lo === hi ? `About a ~${lo} minute walk` : `About a ~${lo}–${hi} minute walk`;
}
