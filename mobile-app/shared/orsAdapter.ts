import { z } from "zod";
import { LIMITS, RouteRejection } from "./contracts.ts";
import type { LonLat, RouteResult, RouteStep } from "./contracts.ts";
import { distanceM } from "./geo.ts";

export const ORS_URL = "https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson";
export const ORS_ATTRIBUTION = "Routes © openrouteservice.org by HeiGIT · Map data © OpenStreetMap contributors";
export const ROUTE_ADAPTER_VERSION = 1;

/** Snap limit for waypoint i of n: wider for the endpoints, strict for planned seats. */
export function snapLimitM(i: number, n: number): number {
  return i === 0 || i === n - 1 ? LIMITS.endpointSnapRadiusM : LIMITS.snapRadiusM;
}

/** Same settings for every comparable candidate. No optimization, no skipped segments. */
export function buildOrsRequest(coordinates: readonly LonLat[]) {
  if (coordinates.length < 2 || coordinates.length > 4) {
    throw new RouteRejection("BAD_WAYPOINT_COUNT");
  }
  return {
    coordinates: coordinates.map(([lon, lat]) => [lon, lat]),
    radiuses: coordinates.map((_, i) => snapLimitM(i, coordinates.length)),
    units: "m",
    instructions: true,
    preference: "shortest",
  };
}

const coordSchema = z.array(z.number()).min(2);
const orsSchema = z.object({
  features: z
    .array(
      z.object({
        geometry: z.object({ type: z.literal("LineString"), coordinates: z.array(coordSchema).min(2) }),
        properties: z.object({
          summary: z.object({ distance: z.number() }),
          segments: z
            .array(
              z.object({
                distance: z.number(),
                steps: z
                  .array(z.object({ distance: z.number(), instruction: z.string() }))
                  .optional(),
              }),
            )
            .min(1),
          way_points: z.array(z.number().int()).min(2),
        }),
      }),
    )
    .min(1),
  metadata: z
    .object({
      attribution: z.string().optional(),
      engine: z.object({ version: z.string().optional() }).optional(),
    })
    .optional(),
});

/**
 * Validate and normalize an ORS GeoJSON directions response.
 * Any failed assertion rejects the candidate; the snap radius is never widened.
 */
export function normalizeOrsRoute(json: unknown, requested: readonly LonLat[], fetchedAt: string): RouteResult {
  const parsed = orsSchema.safeParse(json);
  if (!parsed.success) throw new RouteRejection("MALFORMED_ROUTE");
  const feature = parsed.data.features[0];
  const { summary, segments, way_points } = feature.properties;

  const coordinates: LonLat[] = feature.geometry.coordinates.map((c) => {
    const [lon, lat] = c;
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      throw new RouteRejection("BAD_COORDINATE");
    }
    return [lon, lat] as const;
  });
  if (coordinates.length > LIMITS.maxSnapshotCoordinates) throw new RouteRejection("GEOMETRY_TOO_LARGE");

  if (way_points.length !== requested.length) throw new RouteRejection("WAYPOINT_COUNT_MISMATCH");
  if (segments.length !== way_points.length - 1) throw new RouteRejection("LEG_COUNT_MISMATCH");
  for (let i = 0; i < way_points.length; i++) {
    const idx = way_points[i];
    if (idx < 0 || idx >= coordinates.length) throw new RouteRejection("BAD_WAYPOINT_INDEX");
    if (i > 0 && idx < way_points[i - 1]) throw new RouteRejection("WAYPOINT_ORDER");
  }
  if (way_points[0] !== 0 || way_points[way_points.length - 1] !== coordinates.length - 1) {
    throw new RouteRejection("BAD_WAYPOINT_INDEX");
  }

  const legMetres = segments.map((s) => s.distance);
  if (legMetres.some((m) => !Number.isFinite(m) || m < 0)) throw new RouteRejection("BAD_LEG_DISTANCE");
  const legSum = legMetres.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(summary.distance) || summary.distance <= 0 || legSum <= 0) {
    throw new RouteRejection("ZERO_DISTANCE");
  }
  if (Math.abs(legSum - summary.distance) > Math.max(2, 0.005 * summary.distance)) {
    throw new RouteRejection("LEG_SUM_MISMATCH");
  }

  const snapped = way_points.map((i) => coordinates[i]);
  const snapOffsetsM = snapped.map((s, i) => distanceM(requested[i], s));
  if (snapOffsetsM.some((o, i) => o > snapLimitM(i, snapOffsetsM.length))) throw new RouteRejection("EXCESSIVE_SNAP");

  const steps: RouteStep[] = [];
  segments.forEach((seg, legIndex) => {
    for (const st of seg.steps ?? []) {
      if (Number.isFinite(st.distance) && st.distance >= 0) {
        steps.push({ instruction: st.instruction, distanceM: st.distance, legIndex });
      }
    }
  });

  return {
    source: "ors",
    profile: "foot-walking",
    coordinates,
    requested: requested.map((c) => [c[0], c[1]] as const),
    waypointIndices: way_points,
    snapped,
    snapOffsetsM,
    legMetres,
    // Leg distances are the authority for every comparison.
    totalMetres: legSum,
    steps,
    attribution: ORS_ATTRIBUTION,
    fetchedAt,
    engine: parsed.data.metadata?.engine?.version ?? null,
  };
}
