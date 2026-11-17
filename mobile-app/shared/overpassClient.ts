import type { Catalog } from "./contracts.ts";
import {
  DiscoveryError,
  OVERPASS_MAX_BYTES,
  checkOverpassTransport,
  normalizeOverpass,
} from "./normalizeOverpass.ts";
import { QUERY_VERSION, REGIONS, overpassQuery } from "./region.ts";

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
export const OVERPASS_USER_AGENT = "BenchmarkCoursePrototype/0.1 (student research prototype; cached, bounded use)";
export const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;

/** One bounded discovery request for a configured region. Throws DiscoveryError on any defect. */
export async function fetchCatalog(regionId: string, fetchFn: typeof fetch, now = new Date()): Promise<Catalog> {
  const region = REGIONS[regionId];
  if (!region) throw new DiscoveryError("MALFORMED", "Unsupported region");
  const res = await fetchFn(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": OVERPASS_USER_AGENT,
      Accept: "application/json",
    },
    body: `data=${encodeURIComponent(overpassQuery(region))}`,
    signal: AbortSignal.timeout(40_000),
  });
  const text = await res.text();
  checkOverpassTransport(res.status, res.headers.get("content-type"), text.length);
  if (text.length > OVERPASS_MAX_BYTES) throw new DiscoveryError("TOO_LARGE", "Response too large");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new DiscoveryError("MALFORMED", "Overpass returned invalid JSON");
  }
  return normalizeOverpass(json, {
    regionId,
    queryVersion: QUERY_VERSION,
    fetchedAt: now.toISOString(),
    origin: "live",
    now,
  });
}
