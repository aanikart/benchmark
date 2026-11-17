import Constants from "expo-constants";
import { z } from "zod";
import recorded from "../../data/recorded/overpass-stanford.json";
import {
  candidateRouteSchema,
  catalogSchema,
  comparisonSchema,
} from "../../shared/contracts";
import type { CandidateRoute, Catalog, Comparison, SeatingPrefs } from "../../shared/contracts";
import { normalizeOverpass } from "../../shared/normalizeOverpass";
import { QUERY_VERSION } from "../../shared/region";

export const REGION_ID = "stanford";
const CLIENT_DEADLINE_MS = 30_000; // slightly longer than the 25 s server deadline

/**
 * Where the route service lives.
 * - EXPO_PUBLIC_OUTING_API_URL, when set (e.g. the deployed Supabase function URL).
 * - Otherwise, in development, the laptop running `npm run dev:api` (same host as Metro).
 * The routing key never reaches the app either way.
 */
function apiUrl(): string | null {
  const explicit = process.env.EXPO_PUBLIC_OUTING_API_URL;
  if (explicit) return explicit;
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return __DEV__ && host ? `http://${host}:8787/outing-api` : null;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
    readonly failedEndpoints: readonly ("origin" | "destination")[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const errorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryAfterSeconds: z.number().optional(),
    failedEndpoints: z.array(z.enum(["origin", "destination"])).optional(),
  }),
});

async function post(body: object, signal?: AbortSignal): Promise<unknown> {
  const url = apiUrl();
  if (!url) throw new ApiError("SOURCE_UNAVAILABLE", "The route service is not configured.");
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), CLIENT_DEADLINE_MS);
  const onAbort = () => timeout.abort();
  signal?.addEventListener("abort", onAbort);
  let json: unknown;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: timeout.signal,
    });
    json = await res.json();
  } catch {
    throw new ApiError("SOURCE_UNAVAILABLE", "Couldn't reach the route service. Check your connection and retry.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
  const err = errorSchema.safeParse(json);
  if (err.success) {
    const e = err.data.error;
    throw new ApiError(e.code, e.message, e.retryAfterSeconds, e.failedEndpoints);
  }
  return json;
}

export interface CatalogResult {
  catalog: Catalog;
  /** True when the service could not be reached and the bundled earlier download is shown. */
  serviceUnreachable: boolean;
}

let bundled: Catalog | null = null;
/** A real OpenStreetMap download recorded earlier and shipped with the app (never invented). */
function bundledCatalog(): Catalog {
  bundled ??= normalizeOverpass(recorded.response, {
    regionId: REGION_ID,
    queryVersion: QUERY_VERSION,
    fetchedAt: recorded.provenance.recordedAt,
    origin: "recorded",
    now: new Date(),
  });
  return bundled;
}

export async function fetchPlaces(signal?: AbortSignal): Promise<CatalogResult> {
  try {
    const json = await post({ action: "places", regionId: REGION_ID }, signal);
    const parsed = z.object({ ok: z.literal(true), catalog: catalogSchema }).parse(json);
    return { catalog: parsed.catalog, serviceUnreachable: false };
  } catch {
    return { catalog: bundledCatalog(), serviceUnreachable: true };
  }
}

export type Endpoint = { placeId: string };

export async function fetchComparison(
  input: { requestId: string; origin: Endpoint; destination: Endpoint; prefs: SeatingPrefs },
  signal?: AbortSignal,
): Promise<Comparison> {
  const json = await post({ action: "compare", regionId: REGION_ID, ...input }, signal);
  const parsed = z.object({ ok: z.literal(true), comparison: comparisonSchema }).safeParse(json);
  if (!parsed.success) throw new ApiError("SOURCE_UNAVAILABLE", "The route service sent an unexpected response.");
  return parsed.data.comparison;
}

export async function fetchReturn(
  input: { requestId: string; origin: Endpoint; destination: Endpoint; stopPlaceIds: readonly string[] },
  signal?: AbortSignal,
): Promise<CandidateRoute> {
  const json = await post({ action: "return", regionId: REGION_ID, ...input }, signal);
  const parsed = z.object({ ok: z.literal(true), route: candidateRouteSchema }).safeParse(json);
  if (!parsed.success) throw new ApiError("SOURCE_UNAVAILABLE", "The route service sent an unexpected response.");
  return parsed.data.route;
}

export function newRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
