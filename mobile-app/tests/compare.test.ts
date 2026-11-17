/**
 * Bounded search tests. SYNTHETIC: places sit on an invented east–west line and the route
 * function below fabricates straight-line legs. No real routing is involved.
 */
import { compareRoutes, routeReturn } from "../shared/compareSearch";
import type { RouteFn } from "../shared/compareSearch";
import { LIMITS, OutingError, RouteRejection } from "../shared/contracts";
import type { LonLat, Place } from "../shared/contracts";
import { distanceM } from "../shared/geo";
import { handleOutingRequest } from "../shared/handler";
import { evaluateCandidate } from "../shared/routeMetrics";
import { FETCHED, place, prefs, routed } from "./fixtures";

const LAT = 37.427;
const at = (metresEast: number, metresNorth = 0): LonLat => [
  -122.17 + metresEast / 88_400,
  LAT + metresNorth / 111_320,
];
const origin = at(0);
const destination = at(600);

function fakeRouter(opts: { fail?: (coords: readonly LonLat[]) => Error | null; delayMs?: number } = {}) {
  const log: (readonly LonLat[])[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const route: RouteFn = async (coords) => {
    log.push(coords);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      const err = opts.fail?.(coords);
      if (err) throw err;
      const legs = coords.slice(1).map((c, i) => distanceM(coords[i], c));
      return routed(legs, {
        coordinates: [...coords], requested: [...coords], snapped: [...coords],
        waypointIndices: coords.map((_, i) => i), snapOffsetsM: coords.map(() => 0),
      });
    } finally {
      inFlight -= 1;
    }
  };
  return { route, log, max: () => maxInFlight };
}

const bench = (id: string, east: number, north = 0, over: Partial<Place> = {}) =>
  place({ id, displayCoordinate: at(east, north), routingPoint: at(east, north), ...over });

const run = (places: Place[], r: ReturnType<typeof fakeRouter>, p = prefs(), extra: object = {}) =>
  compareRoutes({
    requestId: "test-request", origin, destination, places, catalogFetchedAt: FETCHED, prefs: p, route: r.route, ...extra,
  });

describe("bounded comparison (synthetic)", () => {
  test("direct + candidates: at most five calls, concurrency two, best alternative returned", async () => {
    const r = fakeRouter({ delayMs: 5 });
    const places = [bench("node/1", 100), bench("node/2", 300, 5), bench("node/3", 450), bench("node/4", 520, 20)];
    const cmp = await run(places, r, prefs({ maxStretchM: 320 }));
    expect(cmp.providerCalls).toBe(r.log.length);
    expect(r.log.length).toBeLessThanOrEqual(LIMITS.maxOutwardCalls);
    expect(r.max()).toBeLessThanOrEqual(2);
    expect(cmp.alternative?.stopPlaceIds).toEqual(["node/2"]);
    expect(cmp.searchComplete).toBe(true);
    // The direct route has no planned stop even though benches lie along it.
    expect(cmp.direct.stopPlaceIds).toEqual([]);
  });

  test("a pair is requested only when no single seat fits", async () => {
    const r = fakeRouter();
    const places = [bench("node/1", 200), bench("node/2", 400)];
    const cmp = await run(places, r, prefs({ maxStretchM: 250 }));
    expect(r.log).toHaveLength(4); // direct, two singles, one pair
    expect(cmp.alternative?.stopPlaceIds).toEqual(["node/1", "node/2"]);
    const e = evaluateCandidate(cmp.alternative!, new Map(places.map((p) => [p.id, p])), prefs({ maxStretchM: 250 }));
    expect(e.analysis.withinMappedPreference).toBe(true);
  });

  test("result is stable when the input order is permuted", async () => {
    const places = [bench("node/5", 310, 8), bench("node/1", 290, 8), bench("node/9", 300, 30), bench("node/3", 120)];
    const a = await run(places, fakeRouter());
    const b = await run([...places].reverse(), fakeRouter());
    expect(b.alternative?.stopPlaceIds).toEqual(a.alternative?.stopPlaceIds);
    expect(b.rejections).toEqual(a.rejections);
  });

  test("near a line only: a bench 8 m away is not a rest without a routed waypoint", async () => {
    const r = fakeRouter();
    const cmp = await run([bench("node/1", 300, 8)], r);
    const e = evaluateCandidate(cmp.direct, new Map(), prefs());
    expect(e.stops).toHaveLength(0);
    expect(e.analysis.stretchesMetres).toHaveLength(1);
  });

  test("no eligible seat: one direct call and a clear reason", async () => {
    const r = fakeRouter();
    const cafe = place({ id: "node/7", role: "landmark", kind: "cafe", seating: "unknown", displayCoordinate: at(300), routingPoint: at(300), tags: {} });
    const cmp = await run([cafe, bench("node/8", 300, 0, { backrest: "unknown" })], r, prefs({ requireBackrest: true }));
    expect(r.log).toHaveLength(1);
    expect(cmp.alternative).toBeNull();
    expect(cmp.alternativeReason).toBe("NO_ELIGIBLE_SEATS");
  });

  test("seats outside the 150 m corridor are not candidates", async () => {
    const cmp = await run([bench("node/1", 300, 200)], fakeRouter());
    expect(cmp.seatsConsidered).toBe(0);
  });

  test("pool is capped at eight per third (24 total)", async () => {
    const many = Array.from({ length: 60 }, (_, i) => bench(`node/${100 + i}`, 5 + i * 10, (i % 7) * 3));
    const cmp = await run(many, fakeRouter());
    expect(cmp.seatsConsidered).toBe(24);
  });

  test("excessive snap rejects that candidate without widening the radius", async () => {
    const r = fakeRouter({ fail: (c) => (c.length === 3 ? new RouteRejection("EXCESSIVE_SNAP") : null) });
    const cmp = await run([bench("node/1", 300)], r);
    expect(cmp.alternative).toBeNull();
    expect(cmp.alternativeReason).toBe("ALL_REJECTED");
    expect(cmp.rejections).toEqual([{ stopPlaceIds: ["node/1"], code: "EXCESSIVE_SNAP" }]);
  });

  test("alternatives over 50% longer than direct are rejected", async () => {
    const cmp = await run([bench("node/1", 300, 149)], fakeRouter());
    expect(cmp.alternative?.stopPlaceIds ?? []).toEqual(["node/1"]); // 670 m vs 600 m: allowed
    const short = await compareRoutes({
      requestId: "r", origin, destination: at(100), places: [bench("node/2", 50, 140)],
      catalogFetchedAt: FETCHED, prefs: prefs({ maxStretchM: 60 }), route: fakeRouter().route,
    });
    expect(short.rejections).toEqual([{ stopPlaceIds: ["node/2"], code: "TOO_LONG" }]);
  });

  test("partial search: deadline passes after the direct route", async () => {
    let t = 0;
    const r = fakeRouter();
    const cmp = await run([bench("node/1", 300)], r, prefs(), { now: () => (t += 20_000), deadlineAt: 15_000 });
    expect(cmp.searchComplete).toBe(false);
    expect(cmp.alternativeReason).toBe("SEARCH_INCOMPLETE");
    expect(cmp.direct.route.totalMetres).toBeGreaterThan(0);
  });

  test("provider failure on a candidate keeps the direct route and does not retry", async () => {
    const r = fakeRouter({ fail: (c) => (c.length === 3 ? new OutingError("SOURCE_UNAVAILABLE", "x") : null) });
    const cmp = await run([bench("node/1", 300)], r);
    expect(r.log).toHaveLength(2);
    expect(cmp.searchComplete).toBe(false);
  });

  test("direct route failures are structured errors", async () => {
    const noSnap = fakeRouter({ fail: () => new RouteRejection("NO_ROUTABLE_POINT", undefined, [1]) });
    await expect(run([], noSnap)).rejects.toMatchObject({ code: "NO_ROUTABLE_POINT", failedEndpoints: ["destination"] });
    expect(noSnap.log).toHaveLength(1); // no hidden probes after a failed endpoint
    await expect(
      compareRoutes({ requestId: "r", origin, destination: at(2500), places: [], catalogFetchedAt: FETCHED, prefs: prefs(), route: fakeRouter().route }),
    ).rejects.toMatchObject({ code: "DIRECT_TOO_LONG" });
    await expect(
      compareRoutes({ requestId: "r", origin, destination: origin, places: [], catalogFetchedAt: FETCHED, prefs: prefs(), route: fakeRouter().route }),
    ).rejects.toMatchObject({ code: "COINCIDENT_ENDPOINTS" });
  });

  test("return is a separate request through the stops in reverse", async () => {
    const r = fakeRouter();
    const places = [bench("node/1", 200), bench("node/2", 400)];
    const back = await routeReturn({
      origin, destination, outwardStopPlaceIds: ["node/1", "node/2"],
      placesById: new Map(places.map((p) => [p.id, p])), route: r.route,
    });
    expect(r.log).toHaveLength(1);
    expect(r.log[0]).toEqual([destination, at(400), at(200), origin]);
    expect(back).toMatchObject({ direction: "return", stopPlaceIds: ["node/2", "node/1"] });
  });
});

describe("request handler (synthetic)", () => {
  const catalog = {
    regionId: "stanford", queryVersion: 1, fetchedAt: FETCHED, osmBase: null, origin: "live" as const, complete: true, areas: [],
    places: [
      place({ id: "node/1", role: "landmark", kind: "cafe", name: "Synthetic A", seating: "unknown", displayCoordinate: at(0), routingPoint: at(0), tags: {} }),
      place({ id: "node/2", role: "landmark", kind: "library", name: "Synthetic B", seating: "unknown", displayCoordinate: at(600), routingPoint: at(600), tags: {} }),
      place({ id: "way/3", coordinateKind: "area_center", routingPoint: null, displayCoordinate: at(300) }),
    ],
  };
  const deps = (r = fakeRouter()) => ({ getCatalog: async () => catalog, route: r.route });
  const base = { action: "compare", regionId: "stanford", requestId: "request-1", prefs: prefs() };

  test("valid compare resolves endpoints from the server catalog", async () => {
    const out = await handleOutingRequest({ ...base, origin: { placeId: "node/1" }, destination: { placeId: "node/2" } }, deps());
    expect(out.ok && out.action === "compare" && out.comparison.direct.route.totalMetres > 0).toBe(true);
  });

  test("invalid input, unknown fields, oversize lists and bad enums are bounded errors", async () => {
    const r = fakeRouter();
    const bad = async (body: unknown) => {
      const out = await handleOutingRequest(body, deps(r));
      return out.ok ? "ok" : out.error.code;
    };
    expect(await bad(null)).toBe("INVALID_REQUEST");
    expect(await bad({ action: "proxy", url: "http://example.com" })).toBe("INVALID_REQUEST");
    expect(await bad({ ...base, origin: { placeId: "node/1" }, destination: { placeId: "node/2" }, ownerId: "someone" })).toBe("INVALID_REQUEST");
    expect(await bad({ ...base, regionId: "elsewhere", origin: { placeId: "node/1" }, destination: { placeId: "node/2" } })).toBe("INVALID_REQUEST");
    expect(await bad({ ...base, origin: { coordinate: [200, 95] }, destination: { placeId: "node/2" } })).toBe("INVALID_REQUEST");
    expect(await bad({ ...base, origin: { coordinate: [-100, 37.43] }, destination: { placeId: "node/2" } })).toBe("LOCATION_OUTSIDE_AREA");
    expect(await bad({ ...base, origin: { placeId: "way/3" }, destination: { placeId: "node/2" } })).toBe("NO_ROUTABLE_POINT");
    expect(await bad({ ...base, origin: { placeId: "node/1" }, destination: { placeId: "node/2" }, prefs: prefs({ maxStretchM: 5 }) })).toBe("INVALID_REQUEST");
    expect(await bad({ action: "return", regionId: "stanford", requestId: "request-2", origin: { placeId: "node/1" }, destination: { placeId: "node/2" }, stopPlaceIds: ["node/1", "node/2", "node/1"] })).toBe("INVALID_REQUEST");
    expect(r.log).toHaveLength(0); // none of these reached the routing provider
  });
});
