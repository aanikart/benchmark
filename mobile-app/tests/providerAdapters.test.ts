import { RouteRejection } from "../shared/contracts";
import { DiscoveryError, checkOverpassTransport, normalizeOverpass } from "../shared/normalizeOverpass";
import { buildOrsRequest, normalizeOrsRoute } from "../shared/orsAdapter";
import { overpassQuery, STANFORD } from "../shared/region";
import { seatEligibility } from "../shared/eligibility";
import recorded from "../data/recorded/overpass-stanford.json";
import { FETCHED, NOW, orsResponse, prefs } from "./fixtures";

const opts = { regionId: "stanford", queryVersion: 1, fetchedAt: FETCHED, origin: "live" as const, now: NOW };
const norm = (elements: unknown[], extra: object = {}) => normalizeOverpass({ elements, ...extra }, opts);
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return "NO_ERROR";
};

describe("discovery adapter (synthetic payloads)", () => {
  test("node / way / relation normalize to a catalog with type-qualified ids", () => {
    const c = norm([
      { type: "node", id: 7, lat: 37.43, lon: -122.17, timestamp: "2025-03-04T00:00:00Z", version: 3, user: "x", uid: 1,
        tags: { amenity: "bench", backrest: "no", check_date: "2025-03" } },
      { type: "way", id: 7, center: { lat: 37.431, lon: -122.171 }, tags: { amenity: "bench", backrest: "yes" } },
      { type: "relation", id: 7, center: { lat: 37.432, lon: -122.172 }, tags: { amenity: "shelter" } },
      { type: "node", id: 8, lat: 37.43, lon: -122.17, tags: { amenity: "cafe", name: "Synthetic Café" } },
    ]);
    expect(c.places.map((p) => p.id).sort()).toEqual(["node/7", "node/8", "relation/7", "way/7"]);
    const node = c.places.find((p) => p.id === "node/7")!;
    expect(node).toMatchObject({ backrest: "no", coordinateKind: "node", mappedCheckDate: "2025-03", sourceVersion: 3 });
    expect(JSON.stringify(c)).not.toContain('"uid"');
    const way = c.places.find((p) => p.id === "way/7")!;
    expect(way).toMatchObject({ coordinateKind: "area_center", routingPoint: null });
    expect(seatEligibility(way, prefs()).reasons).toContain("NOT_A_POINT");
    expect(c.places.find((p) => p.id === "node/8")).toMatchObject({ role: "landmark", seating: "unknown" });
  });

  test('the string "no" is not truthy', () => {
    const c = norm([{ type: "node", id: 1, lat: 37.43, lon: -122.17, tags: { amenity: "bench", backrest: "no" } }]);
    expect(c.places[0].backrest).toBe("no");
  });

  test("timeout remark, malformed JSON shape, HTML and overflow are rejected, not empty successes", () => {
    expect(code(() => norm([], { remark: "runtime error: Query timed out in \"query\" at line 3" }))).toBe("PARTIAL");
    expect(code(() => normalizeOverpass("<html>busy</html>", opts))).toBe("MALFORMED");
    expect(code(() => normalizeOverpass({ nope: 1 }, opts))).toBe("MALFORMED");
    expect(code(() => norm([{ type: "node" }]))).toBe("MALFORMED");
    expect(code(() => norm(Array.from({ length: 2001 }, (_, i) => ({ type: "node", id: i, lat: 1, lon: 1 }))))).toBe("TOO_MANY_ELEMENTS");
    expect(code(() => checkOverpassTransport(502, "text/plain", 10))).toBe("BAD_STATUS");
    expect(code(() => checkOverpassTransport(200, "text/html", 10))).toBe("BAD_CONTENT_TYPE");
    expect(code(() => checkOverpassTransport(200, "application/json", 3 * 1024 * 1024))).toBe("TOO_LARGE");
    expect(() => checkOverpassTransport(200, "application/json", 10)).not.toThrow();
    expect(new DiscoveryError("PARTIAL", "x")).toBeInstanceOf(Error);
  });

  test("duplicate mappings: a bench and shelter at one spot give one candidate with both references", () => {
    const c = norm([
      { type: "node", id: 1, lat: 37.43, lon: -122.17, tags: { amenity: "bench" } },
      { type: "node", id: 2, lat: 37.43001, lon: -122.17001, tags: { amenity: "shelter", bench: "yes" } },
    ]);
    expect(c.places).toHaveLength(1);
    expect(c.places[0]).toMatchObject({ id: "node/1", alsoMappedAs: ["node/2"] });
  });

  test("a landmark mapped twice a few metres apart becomes one destination; distant namesakes stay separate", () => {
    const c = norm([
      { type: "node", id: 10, lat: 37.43, lon: -122.17, tags: { tourism: "artwork", name: "Griffins" } },
      { type: "node", id: 11, lat: 37.43005, lon: -122.17005, tags: { tourism: "artwork", name: "Griffins" } },
      { type: "node", id: 12, lat: 37.42, lon: -122.17, tags: { amenity: "cafe", name: "Twin Cafe" } },
      { type: "node", id: 13, lat: 37.43, lon: -122.17, tags: { amenity: "cafe", name: "Twin Cafe" } },
    ]);
    expect(c.places.map((p) => p.id)).toEqual(["node/10", "node/12", "node/13"]);
    expect(c.places[0].alsoMappedAs).toEqual(["node/11"]);
  });

  test("the query is generated from configured numbers only", () => {
    const q = overpassQuery(STANFORD);
    expect(q).toContain('nwr["amenity"="bench"](37.42,-122.18,37.435,-122.16);');
    expect(q).toContain("out meta center;");
  });
});

describe("recorded live Overpass response (real data, see provenance in the file)", () => {
  const catalog = normalizeOverpass(recorded.response, { ...opts, origin: "recorded", fetchedAt: recorded.provenance.recordedAt });

  test("normalizes and reports coverage", () => {
    const count = (f: (p: (typeof catalog.places)[number]) => boolean) => catalog.places.filter(f).length;
    const report = {
      recordedAt: recorded.provenance.recordedAt,
      total: catalog.places.length,
      benchPoints: count((p) => p.kind === "bench" && p.coordinateKind === "node"),
      benchAreas: count((p) => p.kind === "bench" && p.coordinateKind === "area_center"),
      picnicTables: count((p) => p.kind === "picnic_table"),
      shelters: count((p) => p.kind === "shelter"),
      namedLandmarkPoints: count((p) => p.role === "landmark" && p.routingPoint !== null),
      eligibleDefault: count((p) => seatEligibility(p, prefs()).eligible),
      eligibleWithPicnic: count((p) => seatEligibility(p, prefs({ allowPicnicTables: true })).eligible),
      eligibleBackrestRequired: count((p) => seatEligibility(p, prefs({ requireBackrest: true })).eligible),
      restrictedOrTimedSeats: count(
        (p) => p.role === "seat" && seatEligibility(p, prefs({ allowPicnicTables: true })).reasons.some((r) => r !== "NOT_A_POINT"),
      ),
    };
    console.log("Recorded coverage", report);
    expect(report.benchPoints).toBeGreaterThan(0);
    expect(report.namedLandmarkPoints).toBeGreaterThanOrEqual(2);
    expect(report.eligibleBackrestRequired).toBeLessThan(report.eligibleDefault);
    expect(JSON.stringify(recorded)).not.toMatch(/"(uid|user|changeset)"/);
  });
});

describe("routing adapter (synthetic ORS-shaped payloads; no live ORS request has been made)", () => {
  const req = [[-122.17, 37.427], [-122.169, 37.427], [-122.168, 37.427]] as const;
  const coords = [[-122.17, 37.427], [-122.1695, 37.427], [-122.169, 37.427], [-122.168, 37.427]];

  test("request uses lon/lat order, 10 m radiuses, metres, shortest", () => {
    expect(buildOrsRequest(req)).toEqual({
      coordinates: [[-122.17, 37.427], [-122.169, 37.427], [-122.168, 37.427]],
      radiuses: [10, 10, 10],
      units: "m",
      instructions: true,
      preference: "shortest",
    });
    expect(() => buildOrsRequest([req[0]])).toThrow(RouteRejection);
    expect(() => buildOrsRequest([...req, req[0], req[1]])).toThrow(RouteRejection);
  });

  test("valid response normalizes with leg distances as the authority", () => {
    const r = normalizeOrsRoute(orsResponse({ coordinates: coords, wayPoints: [0, 2, 3], legs: [240, 270], summary: 510.5 }), req, FETCHED);
    expect(r.legMetres).toEqual([240, 270]);
    expect(r.totalMetres).toBe(510);
    expect(r.waypointIndices).toEqual([0, 2, 3]);
    expect(r.snapOffsetsM.every((o) => o < 0.01)).toBe(true);
    expect(r.steps).toHaveLength(2);
  });

  test("excessive snap rejects the candidate (35 m with a 10 m bound)", () => {
    const moved = coords.map((c) => [...c]);
    moved[2] = [-122.169, 37.427 + 35 / 111_320];
    expect(code(() => normalizeOrsRoute(orsResponse({ coordinates: moved, wayPoints: [0, 2, 3], legs: [240, 270] }), req, FETCHED))).toBe("EXCESSIVE_SNAP");
  });

  test("invalid geometry and data are validation errors", () => {
    const bad = (o: Partial<Parameters<typeof orsResponse>[0]>) =>
      code(() => normalizeOrsRoute(orsResponse({ coordinates: coords, wayPoints: [0, 2, 3], legs: [240, 270], ...o }), req, FETCHED));
    expect(bad({ legs: [240] })).toBe("LEG_COUNT_MISMATCH");
    expect(bad({ wayPoints: [0, 9, 3] })).toBe("BAD_WAYPOINT_INDEX");
    expect(bad({ wayPoints: [0, 3, 2] })).toBe("WAYPOINT_ORDER");
    expect(bad({ wayPoints: [0, 3] })).toBe("WAYPOINT_COUNT_MISMATCH");
    expect(bad({ legs: [240, NaN] })).toBe("MALFORMED_ROUTE");
    expect(bad({ legs: [240, -5] })).toBe("BAD_LEG_DISTANCE");
    expect(bad({ legs: [0, 0] })).toBe("ZERO_DISTANCE");
    expect(bad({ summary: 600 })).toBe("LEG_SUM_MISMATCH");
    // reversed lat/lon: latitude out of range
    expect(bad({ coordinates: coords.map(([lon, lat]) => [lat, lon]) })).toBe("BAD_COORDINATE");
    expect(code(() => normalizeOrsRoute({ error: { code: 2010 } }, req, FETCHED))).toBe("MALFORMED_ROUTE");
    expect(code(() => normalizeOrsRoute({ features: [] }, req, FETCHED))).toBe("MALFORMED_ROUTE");
  });

});
