import { LIMITS, OutingError, RouteRejection } from "./contracts.ts";
import type {
  CandidateRoute,
  Comparison,
  LonLat,
  Place,
  Rejection,
  RouteResult,
  SeatingPrefs,
} from "./contracts.ts";
import { bestPair, candidatePool, rankSingles } from "./candidateSearch.ts";
import { seatEligibility } from "./eligibility.ts";
import { distanceM } from "./geo.ts";
import { evaluateCandidate, isUsefulAlternative } from "./routeMetrics.ts";
import type { CandidateEvaluation } from "./routeMetrics.ts";

/** One provider call. Implementations charge budgets and enforce the per-call deadline. */
export type RouteFn = (coordinates: readonly LonLat[], signal?: AbortSignal) => Promise<RouteResult>;

export interface CompareInput {
  requestId: string;
  origin: LonLat;
  destination: LonLat;
  places: readonly Place[];
  catalogFetchedAt: string;
  prefs: SeatingPrefs;
  route: RouteFn;
  /** Absolute time (ms) after which no new provider call starts. */
  deadlineAt?: number;
  now?: () => number;
  signal?: AbortSignal;
}

function sameGeometry(a: RouteResult, b: RouteResult) {
  return (
    a.coordinates.length === b.coordinates.length &&
    a.coordinates.every((c, i) => c[0] === b.coordinates[i][0] && c[1] === b.coordinates[i][1])
  );
}

/**
 * Deterministic bounded search: one direct call, at most three single-seat calls
 * (concurrency two) and at most one pair call. A heuristic, not an exhaustive routed search.
 */
export async function compareRoutes(input: CompareInput): Promise<Comparison> {
  const { origin, destination, prefs, places } = input;
  const now = input.now ?? Date.now;
  const expired = () => input.signal?.aborted === true || (input.deadlineAt !== undefined && now() >= input.deadlineAt);
  let providerCalls = 0;
  const call: RouteFn = (coords, signal) => {
    if (providerCalls >= LIMITS.maxOutwardCalls) throw new RouteRejection("CALL_BUDGET_EXHAUSTED");
    providerCalls += 1;
    return input.route(coords, signal);
  };

  if (distanceM(origin, destination) < 1) {
    throw new OutingError("COINCIDENT_ENDPOINTS", "Choose a destination different from the starting place.");
  }

  let directRoute: RouteResult;
  try {
    directRoute = await call([origin, destination], input.signal);
  } catch (e) {
    if (e instanceof RouteRejection) {
      const failed = e.waypoints.map((i) => (i === 0 ? ("origin" as const) : ("destination" as const)));
      throw new OutingError(
        "NO_ROUTABLE_POINT",
        "A selected point cannot connect to a mapped path within the supported tolerance.",
        undefined,
        failed,
      );
    }
    throw e;
  }
  if (directRoute.totalMetres > LIMITS.maxDirectM) {
    throw new OutingError(
      "DIRECT_TOO_LONG",
      `This version plans outings of up to ${LIMITS.maxDirectM / 1000} km each way.`,
    );
  }

  const placesById = new Map(places.map((p) => [p.id, p]));
  const direct: CandidateRoute = {
    id: "direct",
    kind: "direct",
    direction: "outward",
    route: directRoute,
    stopPlaceIds: [],
  };
  const directEval = evaluateCandidate(direct, placesById, prefs);

  const eligible = places.filter((p) => seatEligibility(p, prefs).eligible);
  const { pool, lengthM } = candidatePool(directRoute.coordinates, eligible);
  const rejections: Rejection[] = [];
  const base = {
    requestId: input.requestId,
    direct,
    rejections,
    seatsConsidered: pool.length,
    catalogFetchedAt: input.catalogFetchedAt,
  };

  if (pool.length === 0) {
    return { ...base, alternative: null, alternativeReason: "NO_ELIGIBLE_SEATS", searchComplete: true, providerCalls };
  }

  type Survivor = { candidate: CandidateRoute; evaluation: CandidateEvaluation };
  const survivors: Survivor[] = [];
  let incomplete = false;

  const tryVia = async (stopIds: string[], points: LonLat[]) => {
    if (expired()) {
      incomplete = true;
      return;
    }
    try {
      const route = await call([origin, ...points, destination], input.signal);
      if (
        route.totalMetres > LIMITS.maxAlternativeM ||
        route.totalMetres > LIMITS.maxAlternativeRatio * directRoute.totalMetres
      ) {
        rejections.push({ stopPlaceIds: stopIds, code: "TOO_LONG" });
        return;
      }
      const candidate: CandidateRoute = {
        id: `via:${stopIds.join("+")}`,
        kind: "via",
        direction: "outward",
        route,
        stopPlaceIds: stopIds,
      };
      survivors.push({ candidate, evaluation: evaluateCandidate(candidate, placesById, prefs) });
    } catch (e) {
      if (e instanceof RouteRejection) rejections.push({ stopPlaceIds: stopIds, code: e.code });
      else if (input.signal?.aborted) incomplete = true;
      else {
        // Timeout or provider failure: this candidate is unavailable; no nested retry.
        incomplete = true;
        rejections.push({ stopPlaceIds: stopIds, code: "PROVIDER_UNAVAILABLE" });
      }
    }
  };

  const singles = rankSingles(pool, lengthM, origin, destination).slice(0, LIMITS.maxSingleTrials);
  // Concurrency two, in stable order.
  for (let i = 0; i < singles.length; i += LIMITS.candidateConcurrency) {
    await Promise.all(
      singles
        .slice(i, i + LIMITS.candidateConcurrency)
        .map((c) => tryVia([c.place.id], [c.point])),
    );
  }

  const useful = (s: Survivor) =>
    isUsefulAlternative(
      directEval.analysis,
      s.evaluation.analysis,
      s.evaluation.stops.filter((st) => st.counted).length,
    );
  const fits = (s: Survivor) => useful(s) && s.evaluation.analysis.withinMappedPreference;

  if (!survivors.some(fits)) {
    const pair = bestPair(pool, lengthM, origin, destination);
    if (pair) await tryVia([pair[0].place.id, pair[1].place.id], [pair[0].point, pair[1].point]);
  }

  const ranked = survivors
    .filter(useful)
    // Keep a same-path option (a planned rest on the direct path is still a meaningful choice),
    // but suppress exact duplicates of geometry and planned stops.
    .filter(
      (s, i, arr) =>
        arr.findIndex(
          (o) =>
            sameGeometry(o.candidate.route, s.candidate.route) &&
            o.candidate.stopPlaceIds.join() === s.candidate.stopPlaceIds.join(),
        ) === i,
    )
    .sort((a, b) => {
      const fa = a.evaluation.analysis.withinMappedPreference ? 0 : 1;
      const fb = b.evaluation.analysis.withinMappedPreference ? 0 : 1;
      return (
        fa - fb ||
        a.evaluation.analysis.longestMappedStretchMetres - b.evaluation.analysis.longestMappedStretchMetres ||
        a.evaluation.analysis.totalMetres - b.evaluation.analysis.totalMetres ||
        (a.candidate.id < b.candidate.id ? -1 : 1)
      );
    });

  const alternative = ranked[0]?.candidate ?? null;
  return {
    ...base,
    alternative,
    alternativeReason: alternative
      ? null
      : incomplete
        ? "SEARCH_INCOMPLETE"
        : survivors.length === 0
          ? "ALL_REJECTED"
          : "NONE_USEFUL",
    searchComplete: !incomplete,
    providerCalls,
  };
}

/**
 * Separately routed return: destination → reversed planned stops → origin. One provider call.
 * The outgoing polyline is never reversed and assumed valid.
 */
export async function routeReturn(input: {
  origin: LonLat;
  destination: LonLat;
  /** Planned stops in outward order. */
  outwardStopPlaceIds: readonly string[];
  placesById: ReadonlyMap<string, Place>;
  route: RouteFn;
  signal?: AbortSignal;
}): Promise<CandidateRoute> {
  const stopIds = [...input.outwardStopPlaceIds].reverse();
  const points = stopIds.map((id) => {
    const p = input.placesById.get(id)?.routingPoint;
    if (!p) throw new RouteRejection("STOP_NOT_ROUTABLE");
    return p;
  });
  const route = await input.route([input.destination, ...points, input.origin], input.signal);
  return {
    id: `return:${stopIds.length ? `via:${stopIds.join("+")}` : "direct"}`,
    kind: stopIds.length ? "via" : "direct",
    direction: "return",
    route,
    stopPlaceIds: stopIds,
  };
}
