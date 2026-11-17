import { LIMITS } from "./contracts.ts";
import type {
  CandidateRoute,
  Place,
  PlannedStopOccurrence,
  RouteAnalysis,
  SeatingPrefs,
} from "./contracts.ts";
import { seatEligibility } from "./eligibility.ts";
import type { ExclusionReason } from "./eligibility.ts";

/**
 * Pure domain logic. restAfterLeg[i] says whether the waypoint reached by leg i counts as a rest.
 * Excluded stops do not reset the accumulator; the final stretch is always emitted.
 */
export function mappedStretches(
  legMetres: readonly number[],
  restAfterLeg: readonly boolean[],
): number[] {
  if (
    legMetres.length === 0 ||
    legMetres.length !== restAfterLeg.length ||
    legMetres.some((m) => !Number.isFinite(m) || m < 0)
  ) {
    throw new Error("Invalid route legs or rest boundaries");
  }
  const stretches: number[] = [];
  let accumulated = 0;
  legMetres.forEach((metres, i) => {
    accumulated += metres;
    const isLast = i === legMetres.length - 1;
    if (isLast || restAfterLeg[i]) {
      stretches.push(accumulated);
      accumulated = 0;
    }
  });
  return stretches;
}

export function analyzeLegs(
  legMetres: readonly number[],
  restAfterLeg: readonly boolean[],
  maxStretchM: number,
): RouteAnalysis {
  const stretchesMetres = mappedStretches(legMetres, restAfterLeg);
  const totalMetres = legMetres.reduce((a, b) => a + b, 0);
  if (!(totalMetres > 0)) throw new Error("A route must have a positive distance");
  if (!Number.isFinite(maxStretchM) || maxStretchM <= 0) throw new Error("Invalid preference");
  const longest = Math.max(...stretchesMetres);
  return {
    legMetres: [...legMetres],
    stretchesMetres,
    totalMetres,
    longestMappedStretchMetres: longest,
    // Exact, unrounded comparison: 300.4 m does not fit 300 m.
    withinMappedPreference: longest <= maxStretchM,
    availability: "unconfirmed",
  };
}

export interface CandidateEvaluation {
  analysis: RouteAnalysis;
  stops: readonly PlannedStopOccurrence[];
}

/**
 * Derive counted stops and stretches for one routed candidate. Shared by server and client so
 * the card, ribbon, snapshot and screen-reader text cannot compute different answers.
 * Stops are associated by waypoint index and leg order, never by a global nearest-point search.
 */
export function evaluateCandidate(
  candidate: CandidateRoute,
  placesById: ReadonlyMap<string, Place>,
  prefs: SeatingPrefs,
  previewWithout: ReadonlySet<string> = new Set(),
): CandidateEvaluation {
  const { route, stopPlaceIds } = candidate;
  if (route.legMetres.length !== stopPlaceIds.length + 1) {
    throw new Error("Stops do not match route legs");
  }
  const restAfterLeg: boolean[] = route.legMetres.map(() => false);
  const stops: PlannedStopOccurrence[] = [];
  let along = 0;
  let lastCountedAlong: number | null = null;

  stopPlaceIds.forEach((placeId, i) => {
    along += route.legMetres[i];
    const waypointIndex = i + 1;
    const place = placesById.get(placeId);
    const reasons: ExclusionReason[] = place
      ? [...seatEligibility(place, prefs).reasons]
      : ["SEATING_NOT_MAPPED"];
    if (previewWithout.has(placeId)) reasons.push("PREVIEW_WITHOUT_STOP");
    // Never count two rest boundaries within 5 m along the route as independent opportunities.
    if (
      reasons.length === 0 &&
      lastCountedAlong !== null &&
      along - lastCountedAlong < LIMITS.duplicateRestM
    ) {
      reasons.push("DUPLICATE_ALONG_ROUTE");
    }
    const counted = reasons.length === 0;
    if (counted) {
      restAfterLeg[i] = true;
      lastCountedAlong = along;
    }
    stops.push({
      // Direction is part of the identity: the same seat can be reached outward and returning.
      occurrenceId: `${candidate.direction}:${waypointIndex}:${placeId}`,
      placeId,
      waypointIndex,
      snappedCoordinate: route.snapped[waypointIndex],
      snapOffsetMetres: route.snapOffsetsM[waypointIndex],
      counted,
      exclusionReasons: reasons,
      approach: "unconfirmed",
    });
  });

  return { analysis: analyzeLegs(route.legMetres, restAfterLeg, prefs.maxStretchM), stops };
}

/**
 * Stretches for the complete outing. Unless there is an eligible planned rest at the
 * destination, the last outward stretch joins the first return stretch.
 */
export function joinRoundTrip(
  outwardStretches: readonly number[],
  returnStretches: readonly number[],
  restAtDestination = false,
): number[] {
  if (outwardStretches.length === 0 || returnStretches.length === 0) {
    throw new Error("Both directions need at least one stretch");
  }
  if (restAtDestination) return [...outwardStretches, ...returnStretches];
  return [
    ...outwardStretches.slice(0, -1),
    outwardStretches[outwardStretches.length - 1] + returnStretches[0],
    ...returnStretches.slice(1),
  ];
}

/**
 * A useful alternative has at least one counted rest and either changes an unmet mapped
 * preference to a met one, or shortens the longest stretch by min(25 m, 10% of direct).
 * The first condition takes precedence.
 */
export function isUsefulAlternative(
  direct: RouteAnalysis,
  alternative: RouteAnalysis,
  countedRests: number,
): boolean {
  if (countedRests < 1) return false;
  if (!direct.withinMappedPreference && alternative.withinMappedPreference) return true;
  const needed = Math.min(25, 0.1 * direct.totalMetres);
  return direct.longestMappedStretchMetres - alternative.longestMappedStretchMetres >= needed;
}

/**
 * Outing guide: planned distance from the last confirmed rest through the next planned rest.
 * `restedAfterLeg[i]` is true only when the person said "I rested here" at the waypoint
 * reached by leg i. Reaching a stop without resting does not reset the distance.
 * This is distance along the planned path, not measured movement.
 */
export function plannedStretchFromLastRest(
  legMetres: readonly number[],
  plannedRestAfterLeg: readonly boolean[],
  restedAfterLeg: readonly boolean[],
  reachedLegs: number,
): number {
  if (
    legMetres.length === 0 ||
    legMetres.length !== plannedRestAfterLeg.length ||
    legMetres.length !== restedAfterLeg.length ||
    !Number.isInteger(reachedLegs) || reachedLegs < 0 || reachedLegs > legMetres.length ||
    legMetres.some((m) => !Number.isFinite(m) || m < 0)
  ) {
    throw new Error("Invalid guide state");
  }
  let start = 0;
  for (let i = 0; i < reachedLegs; i++) if (restedAfterLeg[i]) start = i + 1;
  let total = 0;
  for (let i = start; i < legMetres.length; i++) {
    total += legMetres[i];
    // The next planned rest ahead of the person ends the stretch.
    if (i >= reachedLegs && plannedRestAfterLeg[i]) break;
  }
  return total;
}
