import { z } from "zod";
import { compareRoutes, routeReturn } from "./compareSearch.ts";
import type { RouteFn } from "./compareSearch.ts";
import {
  LIMITS,
  OutingError,
  RouteRejection,
  lonLatSchema,
  seatingPrefsSchema,
} from "./contracts.ts";
import type { CandidateRoute, Catalog, Comparison, LonLat } from "./contracts.ts";
import { REGIONS, inRegion } from "./region.ts";

const placeId = z.string().regex(/^(node|way|relation)\/\d+$/).max(40);
const endpoint = z.union([
  z.object({ placeId }).strict(),
  z.object({ coordinate: lonLatSchema }).strict(),
]);

export const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("places"), regionId: z.string().max(40) }).strict(),
  z
    .object({
      action: z.literal("compare"),
      regionId: z.string().max(40),
      requestId: z.string().min(8).max(64),
      origin: endpoint,
      destination: endpoint,
      prefs: seatingPrefsSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("return"),
      regionId: z.string().max(40),
      requestId: z.string().min(8).max(64),
      origin: endpoint,
      destination: endpoint,
      /** Outward order; the server reverses them. */
      stopPlaceIds: z.array(placeId).max(2),
    })
    .strict(),
]);
export type OutingRequest = z.infer<typeof requestSchema>;

export type OutingResponse =
  | { ok: true; action: "places"; catalog: Catalog }
  | { ok: true; action: "compare"; comparison: Comparison }
  | { ok: true; action: "return"; route: CandidateRoute }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        retryAfterSeconds?: number;
        failedEndpoints?: readonly ("origin" | "destination")[];
      };
    };

export interface HandlerDeps {
  /** Shared regional catalog (cache lives behind this). */
  getCatalog: (regionId: string) => Promise<Catalog>;
  /** One provider call; the implementation charges budgets. */
  route: RouteFn;
  now?: () => number;
}

export const MAX_REQUEST_BYTES = 16 * 1024;

function resolve(
  e: z.infer<typeof endpoint>,
  catalog: Catalog,
  regionId: string,
): LonLat {
  let point: LonLat | null;
  if ("placeId" in e) {
    const place = catalog.places.find((p) => p.id === e.placeId);
    if (!place) throw new OutingError("INVALID_REQUEST", "That place is not in the current catalog.");
    // An area center is never substituted silently for a routable point.
    point = place.routingPoint;
    if (!point) {
      throw new OutingError("NO_ROUTABLE_POINT", "That place is mapped as an area. Choose a nearby point place.");
    }
  } else {
    point = e.coordinate;
  }
  if (!inRegion(REGIONS[regionId], point)) {
    throw new OutingError("LOCATION_OUTSIDE_AREA", "That point is outside the supported planning area.");
  }
  return point;
}

/**
 * Transport-independent request handler shared by the Supabase Edge Function and the local
 * development server. Never proxies caller-supplied URLs; stop coordinates come from the
 * server catalog.
 */
export async function handleOutingRequest(body: unknown, deps: HandlerDeps): Promise<OutingResponse> {
  try {
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) throw new OutingError("INVALID_REQUEST", "The request was not understood.");
    const req = parsed.data;
    if (!REGIONS[req.regionId]) throw new OutingError("INVALID_REQUEST", "Unsupported area.");
    const catalog = await deps.getCatalog(req.regionId);

    if (req.action === "places") return { ok: true, action: "places", catalog };

    const origin = resolve(req.origin, catalog, req.regionId);
    const destination = resolve(req.destination, catalog, req.regionId);
    const now = deps.now ?? Date.now;

    if (req.action === "compare") {
      const comparison = await compareRoutes({
        requestId: req.requestId,
        origin,
        destination,
        places: catalog.places,
        catalogFetchedAt: catalog.fetchedAt,
        prefs: req.prefs,
        route: deps.route,
        deadlineAt: now() + LIMITS.compareDeadlineMs,
        now,
      });
      return { ok: true, action: "compare", comparison };
    }

    const placesById = new Map(catalog.places.map((p) => [p.id, p]));
    try {
      const route = await routeReturn({
        origin,
        destination,
        outwardStopPlaceIds: req.stopPlaceIds,
        placesById,
        route: deps.route,
      });
      return { ok: true, action: "return", route };
    } catch (e) {
      if (e instanceof RouteRejection) {
        throw new OutingError("NO_ROUTABLE_POINT", "A return route through these stops could not be found.");
      }
      throw e;
    }
  } catch (e) {
    if (e instanceof OutingError) {
      return {
        ok: false,
        error: {
          code: e.code,
          message: e.message,
          retryAfterSeconds: e.retryAfterSeconds,
          failedEndpoints: e.failedEndpoints,
        },
      };
    }
    return { ok: false, error: { code: "SOURCE_UNAVAILABLE", message: "Something went wrong. Please retry." } };
  }
}
