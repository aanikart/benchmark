import type { OutingSnapshot, Place } from "../../../shared/contracts";
import { evaluateCandidate, joinRoundTrip } from "../../../shared/routeMetrics";
import type { CandidateEvaluation } from "../../../shared/routeMetrics";

export interface OutingView {
  placesById: Map<string, Place>;
  outward: CandidateEvaluation;
  back: CandidateEvaluation | null;
  /** Stretches for the whole outing; null unless a walk-back route is saved. */
  completeStretches: number[] | null;
  returnLabel: string;
}

export const RETURN_LABEL = {
  walk: "Walking back",
  arranged: "Getting a ride back",
  undecided: "One way for now",
} as const;

/** Derive a saved outing's metrics from its own snapshot (never from today's catalog). */
export function outingView(s: OutingSnapshot): OutingView {
  const placesById = new Map(s.places.map((p) => [p.id, p]));
  const outward = evaluateCandidate(s.outward, placesById, s.prefs);
  const back = s.returnRoute ? evaluateCandidate(s.returnRoute, placesById, s.prefs) : null;
  return {
    placesById,
    outward,
    back,
    // A destination (even a café or library) is not a rest unless a planned eligible seat is there.
    completeStretches: back
      ? joinRoundTrip(outward.analysis.stretchesMetres, back.analysis.stretchesMetres, false)
      : null,
    returnLabel: RETURN_LABEL[s.returnMode],
  };
}

export function ageLabel(iso: string, now = Date.now()): string {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return "date unknown";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
