import { z } from "zod";

export const SNAPSHOT_SCHEMA_VERSION = 1;

/** Search limits disclosed to the person; prototype tuning values, not physiological thresholds. */
export const LIMITS = {
  /** Benches must sit on the route to count as a rest. */
  snapRadiusM: 10,
  /**
   * Start and destination may be set back from a path (a café inside a building, a sculpture
   * on a lawn). The route then begins/ends at the nearest mapped path, and the app shows that gap.
   */
  endpointSnapRadiusM: 60,
  nearBandM: 15,
  corridorM: 150,
  maxDirectM: 2000,
  maxAlternativeM: 2500,
  maxAlternativeRatio: 1.5,
  perThird: 8,
  maxSingleTrials: 3,
  duplicateRestM: 5,
  minPreferenceM: 50,
  maxPreferenceM: 1000,
  maxOutwardCalls: 5,
  candidateConcurrency: 2,
  routeDeadlineMs: 10_000,
  compareDeadlineMs: 25_000,
  maxSnapshotBytes: 512 * 1024,
  maxSnapshotCoordinates: 10_000,
  maxNoteLength: 500,
  maxExclusions: 100,
} as const;

const lon = z.number().finite().min(-180).max(180);
const lat = z.number().finite().min(-90).max(90);
export const lonLatSchema = z.tuple([lon, lat]).readonly();
export type LonLat = readonly [longitude: number, latitude: number];

export const knownBooleanSchema = z.enum(["yes", "no", "unknown"]);
export type KnownBoolean = z.infer<typeof knownBooleanSchema>;

export const placeKindSchema = z.enum([
  "bench",
  "picnic_table",
  "shelter",
  "artwork",
  "viewpoint",
  "library",
  "cafe",
  "community_centre",
]);
export type PlaceKind = z.infer<typeof placeKindSchema>;

export const placeSchema = z.object({
  id: z.string().regex(/^(node|way|relation)\/\d+$/),
  role: z.enum(["seat", "landmark"]),
  kind: placeKindSchema,
  name: z.string().nullable(),
  displayCoordinate: lonLatSchema,
  coordinateKind: z.enum(["node", "area_center"]),
  routingPoint: lonLatSchema.nullable(),
  tags: z.record(z.string(), z.string()).readonly(),
  seating: knownBooleanSchema,
  backrest: knownBooleanSchema,
  armrest: knownBooleanSchema,
  sourceVersion: z.number().int().nullable(),
  sourceEditedAt: z.string().nullable(),
  mappedCheckDate: z.string().nullable(),
  mappedSurveyDate: z.string().nullable(),
  fetchedAt: z.string(),
  /** Other source objects describing the same apparent seating location (within 5 m). */
  alsoMappedAs: z.array(z.string()).readonly(),
});
export type Place = z.infer<typeof placeSchema>;

/** A named outline used only to describe location. Never a routing point or a seat. */
export const contextAreaSchema = z.object({
  id: z.string().regex(/^(way|relation)\/\d+$/),
  name: z.string(),
  shortName: z.string().nullable(),
  kind: z.enum(["garden", "park", "complex", "building"]),
  ring: z.array(lonLatSchema).min(4).readonly(),
});
export type ContextArea = z.infer<typeof contextAreaSchema>;

export const catalogSchema = z.object({
  regionId: z.string(),
  queryVersion: z.number().int(),
  fetchedAt: z.string(),
  osmBase: z.string().nullable(),
  /** "recorded" = a real earlier download bundled with the app; "live" = fetched this session. */
  origin: z.enum(["live", "recorded"]),
  complete: z.boolean(),
  places: z.array(placeSchema).readonly(),
  areas: z.array(contextAreaSchema).readonly().default([]),
});
export type Catalog = z.infer<typeof catalogSchema>;

export const seatingPrefsSchema = z.object({
  maxStretchM: z.number().finite().min(LIMITS.minPreferenceM).max(LIMITS.maxPreferenceM),
  requireBackrest: z.boolean(),
  allowPicnicTables: z.boolean(),
  excludedPlaceIds: z.array(z.string()).max(LIMITS.maxExclusions).readonly(),
});
export type SeatingPrefs = z.infer<typeof seatingPrefsSchema>;

export const routeStepSchema = z.object({
  instruction: z.string(),
  distanceM: z.number().finite().nonnegative(),
  legIndex: z.number().int().nonnegative(),
});
export type RouteStep = z.infer<typeof routeStepSchema>;

export const routeResultSchema = z.object({
  source: z.literal("ors"),
  profile: z.literal("foot-walking"),
  coordinates: z.array(lonLatSchema).min(2).max(LIMITS.maxSnapshotCoordinates).readonly(),
  requested: z.array(lonLatSchema).min(2).max(4).readonly(),
  waypointIndices: z.array(z.number().int().nonnegative()).min(2).max(4).readonly(),
  snapped: z.array(lonLatSchema).min(2).max(4).readonly(),
  snapOffsetsM: z.array(z.number().finite().nonnegative()).min(2).max(4).readonly(),
  legMetres: z.array(z.number().finite().nonnegative()).min(1).max(3).readonly(),
  totalMetres: z.number().finite().positive(),
  steps: z.array(routeStepSchema).readonly(),
  attribution: z.string(),
  fetchedAt: z.string(),
  engine: z.string().nullable(),
});
export type RouteResult = z.infer<typeof routeResultSchema>;

export const stopOccurrenceSchema = z.object({
  occurrenceId: z.string(),
  placeId: z.string(),
  waypointIndex: z.number().int().positive(),
  snappedCoordinate: lonLatSchema,
  snapOffsetMetres: z.number().finite().nonnegative(),
  counted: z.boolean(),
  exclusionReasons: z.array(z.string()).readonly(),
  approach: z.literal("unconfirmed"),
});
export type PlannedStopOccurrence = z.infer<typeof stopOccurrenceSchema>;

export const routeAnalysisSchema = z.object({
  legMetres: z.array(z.number()).readonly(),
  stretchesMetres: z.array(z.number()).readonly(),
  totalMetres: z.number(),
  longestMappedStretchMetres: z.number(),
  withinMappedPreference: z.boolean(),
  availability: z.literal("unconfirmed"),
});
export type RouteAnalysis = z.infer<typeof routeAnalysisSchema>;

export const candidateRouteSchema = z.object({
  id: z.string(),
  kind: z.enum(["direct", "via"]),
  direction: z.enum(["outward", "return"]),
  route: routeResultSchema,
  /** Seat place ids in route order; index i sits at waypoint i + 1. */
  stopPlaceIds: z.array(z.string()).max(2).readonly(),
});
export type CandidateRoute = z.infer<typeof candidateRouteSchema>;

export const rejectionSchema = z.object({
  stopPlaceIds: z.array(z.string()).readonly(),
  code: z.string(),
});
export type Rejection = z.infer<typeof rejectionSchema>;

export const comparisonSchema = z.object({
  requestId: z.string(),
  direct: candidateRouteSchema,
  alternative: candidateRouteSchema.nullable(),
  /** Why there is no alternative card, when `alternative` is null. */
  alternativeReason: z
    .enum(["NO_ELIGIBLE_SEATS", "NONE_USEFUL", "ALL_REJECTED", "SEARCH_INCOMPLETE"])
    .nullable(),
  searchComplete: z.boolean(),
  providerCalls: z.number().int().nonnegative(),
  rejections: z.array(rejectionSchema).readonly(),
  seatsConsidered: z.number().int().nonnegative(),
  catalogFetchedAt: z.string(),
});
export type Comparison = z.infer<typeof comparisonSchema>;

export const ERROR_CODES = [
  "LOCATION_OUTSIDE_AREA",
  "NO_ROUTABLE_POINT",
  "SOURCE_UNAVAILABLE",
  "RATE_LIMITED",
  "DIRECT_TOO_LONG",
  "COINCIDENT_ENDPOINTS",
  "INVALID_REQUEST",
  "UNAUTHENTICATED",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export class OutingError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly retryAfterSeconds?: number,
    /** For NO_ROUTABLE_POINT on the direct request: which selected endpoints failed. */
    readonly failedEndpoints?: readonly ("origin" | "destination")[],
  ) {
    super(message);
    this.name = "OutingError";
  }
}

/** A candidate-level failure: the candidate becomes unavailable, never a zero-distance success. */
export class RouteRejection extends Error {
  constructor(
    readonly code: string,
    message?: string,
    /** Request waypoint indices the provider could not snap, when it reports them. */
    readonly waypoints: readonly number[] = [],
  ) {
    super(message ?? code);
    this.name = "RouteRejection";
  }
}

export const returnModeSchema = z.enum(["walk", "arranged", "undecided"]);
export type ReturnMode = z.infer<typeof returnModeSchema>;

export const outingSnapshotSchema = z
  .object({
    schemaVersion: z.literal(SNAPSHOT_SCHEMA_VERSION),
    regionId: z.string(),
    originPlaceId: z.string(),
    destinationPlaceId: z.string(),
    prefs: seatingPrefsSchema,
    outward: candidateRouteSchema,
    returnMode: returnModeSchema,
    returnRoute: candidateRouteSchema.nullable(),
    /** Source fields for every place the plan refers to, as they were when saved. */
    places: z.array(placeSchema).readonly(),
    catalogFetchedAt: z.string(),
    catalogOrigin: z.enum(["live", "recorded"]),
    attribution: z.array(z.string()).readonly(),
    savedAt: z.string(),
  })
  .refine((s) => s.returnMode !== "walk" || s.returnRoute !== null, {
    message: "A walk-back plan requires a return route",
  })
  .refine((s) => s.returnMode === "walk" || s.returnRoute === null, {
    message: "Only a walk-back plan carries a return route",
  });
export type OutingSnapshot = z.infer<typeof outingSnapshotSchema>;
