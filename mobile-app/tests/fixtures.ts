/**
 * SYNTHETIC FIXTURES. Every place, coordinate and distance in this file is invented for
 * deterministic tests. None of it describes a real location. The only real data used by the
 * tests is data/recorded/overpass-stanford.json (see its `provenance` field).
 */
import type { CandidateRoute, LonLat, Place, RouteResult, SeatingPrefs } from "../shared/contracts";

export const NOW = new Date("2026-11-16T12:00:00Z");
export const FETCHED = "2026-11-16T10:00:00.000Z";

export const prefs = (over: Partial<SeatingPrefs> = {}): SeatingPrefs => ({
  maxStretchM: 300,
  requireBackrest: false,
  allowPicnicTables: false,
  excludedPlaceIds: [],
  ...over,
});

export function place(over: Partial<Place> & { id: string }): Place {
  const coord: LonLat = over.displayCoordinate ?? [-122.17, 37.427];
  return {
    role: "seat",
    kind: "bench",
    name: null,
    displayCoordinate: coord,
    coordinateKind: "node",
    routingPoint: coord,
    tags: { amenity: "bench" },
    seating: "yes",
    backrest: "unknown",
    armrest: "unknown",
    sourceVersion: 1,
    sourceEditedAt: "2025-03-04T00:00:00.000Z",
    mappedCheckDate: null,
    mappedSurveyDate: null,
    fetchedAt: FETCHED,
    alsoMappedAs: [],
    ...over,
  };
}

/** Synthetic routed result with the given leg distances; geometry is a placeholder line. */
export function routed(legMetres: number[], over: Partial<RouteResult> = {}): RouteResult {
  const n = legMetres.length + 1;
  const coords: LonLat[] = Array.from({ length: n }, (_, i) => [-122.17 + i * 0.001, 37.427] as const);
  return {
    source: "ors",
    profile: "foot-walking",
    coordinates: coords,
    requested: coords,
    waypointIndices: coords.map((_, i) => i),
    snapped: coords,
    snapOffsetsM: coords.map(() => 0),
    legMetres,
    totalMetres: legMetres.reduce((a, b) => a + b, 0),
    steps: [],
    attribution: "synthetic",
    fetchedAt: FETCHED,
    engine: null,
    ...over,
  };
}

export function candidate(
  legMetres: number[],
  stopPlaceIds: string[],
  direction: "outward" | "return" = "outward",
): CandidateRoute {
  return {
    id: stopPlaceIds.length ? `via:${stopPlaceIds.join("+")}` : "direct",
    kind: stopPlaceIds.length ? "via" : "direct",
    direction,
    route: routed(legMetres),
    stopPlaceIds,
  };
}

/** Synthetic ORS GeoJSON response in the documented shape. */
export function orsResponse(opts: {
  coordinates: number[][];
  wayPoints: number[];
  legs: number[];
  summary?: number;
}) {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: opts.coordinates },
        properties: {
          summary: { distance: opts.summary ?? opts.legs.reduce((a, b) => a + b, 0), duration: 1 },
          segments: opts.legs.map((d) => ({
            distance: d,
            duration: 1,
            steps: [{ distance: d, duration: 1, instruction: "Head east", name: "-", way_points: [0, 1] }],
          })),
          way_points: opts.wayPoints,
        },
      },
    ],
    metadata: { attribution: "openrouteservice.org", engine: { version: "synthetic" } },
  };
}
