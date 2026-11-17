import { LIMITS, OutingError, RouteRejection } from "./contracts.ts";
import type { LonLat } from "./contracts.ts";
import type { RouteFn } from "./compareSearch.ts";
import { ORS_URL, buildOrsRequest, normalizeOrsRoute } from "./orsAdapter.ts";

export interface OrsClientOptions {
  apiKey: string;
  fetch: typeof fetch;
  /** Called once per outgoing provider request, before it is sent (budget charging, logging). */
  onCall?: (waypoints: number) => void | Promise<void>;
  now?: () => Date;
}

/**
 * Server-side openrouteservice client. The key is a server secret: this module must never be
 * constructed inside the mobile bundle. One request per call; no automatic retries.
 */
export function makeOrsRoute(opts: OrsClientOptions): RouteFn {
  return async (coordinates: readonly LonLat[], signal?: AbortSignal) => {
    const body = buildOrsRequest(coordinates);
    await opts.onCall?.(coordinates.length);
    const timeout = AbortSignal.timeout(LIMITS.routeDeadlineMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let res: Response;
    try {
      res = await opts.fetch(ORS_URL, {
        method: "POST",
        headers: { Authorization: opts.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: combined,
      });
    } catch {
      throw new OutingError("SOURCE_UNAVAILABLE", "The routing service did not respond in time.");
    }
    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after"));
      throw new OutingError(
        "RATE_LIMITED",
        "The routing service is limiting requests.",
        Number.isFinite(retry) && retry > 0 ? retry : 60,
      );
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new RouteRejection("MALFORMED_ROUTE");
    }
    if (!res.ok) {
      const err = (json as { error?: { code?: number; message?: string } })?.error;
      const code = err?.code;
      // 2010: no routable point within the snapping radius. 2009: no route between points.
      if (code === 2010) {
        const idx = [...(err?.message ?? "").matchAll(/coordinate (\d+)/g)].map((m) => Number(m[1]));
        throw new RouteRejection("NO_ROUTABLE_POINT", undefined, idx);
      }
      if (code === 2009) throw new RouteRejection("NO_ROUTE");
      if (res.status >= 500) throw new OutingError("SOURCE_UNAVAILABLE", "The routing service is unavailable.");
      throw new RouteRejection(`PROVIDER_${res.status}`);
    }
    return normalizeOrsRoute(json, coordinates, (opts.now?.() ?? new Date()).toISOString());
  };
}
