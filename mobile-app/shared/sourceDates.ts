/**
 * OSM date tags (check_date, survey:date) keep their original precision.
 * A partial date such as "2025-03" stays partial; malformed or future values are not evidence.
 */
export interface SourceDate {
  /** Accepted value at original precision (YYYY, YYYY-MM or YYYY-MM-DD), else null. */
  value: string | null;
  /** Raw tag text, kept for diagnostics. */
  raw: string | null;
}

const DATE_RE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

export function parseSourceDate(raw: string | undefined | null, now: Date): SourceDate {
  if (raw == null) return { value: null, raw: null };
  const text = raw.trim();
  const m = DATE_RE.exec(text);
  if (!m) return { value: null, raw };
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : null;
  const day = m[3] ? Number(m[3]) : null;
  if (year < 2004) return { value: null, raw }; // before OpenStreetMap existed
  if (month !== null && (month < 1 || month > 12)) return { value: null, raw };
  if (day !== null) {
    const d = new Date(Date.UTC(year, month! - 1, day));
    if (d.getUTCMonth() !== month! - 1 || d.getUTCDate() !== day) return { value: null, raw };
  }
  // Earliest instant the partial date could denote must not be in the future.
  const earliest = Date.UTC(year, (month ?? 1) - 1, day ?? 1);
  if (earliest > now.getTime()) return { value: null, raw };
  return { value: text, raw };
}

/** ISO timestamp from `out meta`; rejects malformed and future values. */
export function parseEditTimestamp(raw: unknown, now: Date): string | null {
  if (typeof raw !== "string") return null;
  const t = Date.parse(raw);
  if (!Number.isFinite(t) || t > now.getTime()) return null;
  return new Date(t).toISOString();
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Render a date at the precision it was recorded with; never invents a day. */
export function formatSourceDate(value: string | null): string {
  if (!value) return "Not mapped";
  const m = DATE_RE.exec(value.slice(0, 10));
  if (!m) return "Not mapped";
  const [, y, mo, d] = m;
  if (!mo) return y;
  if (!d) return `${MONTHS[Number(mo) - 1]} ${y}`;
  return `${MONTHS[Number(mo) - 1]} ${Number(d)}, ${y}`;
}
