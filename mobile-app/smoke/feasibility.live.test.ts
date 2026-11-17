/**
 * LIVE provider smoke test: makes real openrouteservice requests using ORS_API_KEY from .env.
 * Not part of `npm test`. Run deliberately with `npm run smoke:live` (uses routing quota).
 */
import recorded from "../data/recorded/overpass-stanford.json";
import { compareRoutes, routeReturn } from "../shared/compareSearch";
import type { RouteFn } from "../shared/compareSearch";
import type { SeatingPrefs } from "../shared/contracts";
import { normalizeOverpass } from "../shared/normalizeOverpass";
import { makeOrsRoute } from "../shared/orsClient";
import { nodeFetch } from "./nodeFetch";
import { evaluateCandidate, joinRoundTrip } from "../shared/routeMetrics";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const env = require("../scripts/loadEnv.cjs")() as Record<string, string>;
const catalog = normalizeOverpass(recorded.response, {
  regionId: "stanford", queryVersion: 1, fetchedAt: recorded.provenance.recordedAt, origin: "recorded", now: new Date(),
});
const byId = new Map(catalog.places.map((p) => [p.id, p]));

const PAIRS: [string, string][] = [
  ["node/3355037887", "node/5648594207"], // Coupa Cafe → The Burghers of Calais
  ["node/5206903613", "node/6593596200"], // Tanner Philosophy Library → Cantor Cafe
  ["node/13816232081", "node/4846515988"], // Tresidder Oak Lounge → Robert Crown Law Library
];

jest.setTimeout(120_000);

test("live: real comparisons through mapped seats", async () => {
  expect(env.ORS_API_KEY).toBeTruthy();
  let calls = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const ors = makeOrsRoute({ apiKey: env.ORS_API_KEY, fetch: nodeFetch, onCall: () => { calls += 1; } });
  const route: RouteFn = async (c, s) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try { return await ors(c, s); } finally { inFlight -= 1; }
  };
  const prefs: SeatingPrefs = { maxStretchM: 150, requireBackrest: false, allowPicnicTables: false, excludedPlaceIds: [] };
  const rows: unknown[] = [];
  let useful = 0;

  for (const [a, b] of PAIRS) {
    const before = calls;
    const origin = byId.get(a)!;
    const dest = byId.get(b)!;
    try {
      const cmp = await compareRoutes({
        requestId: `${a}>${b}`, origin: origin.routingPoint!, destination: dest.routingPoint!,
        places: catalog.places, catalogFetchedAt: catalog.fetchedAt, prefs, route,
      });
      const d = evaluateCandidate(cmp.direct, byId, prefs);
      const row: Record<string, unknown> = {
        from: origin.name, to: dest.name, calls: calls - before, searchComplete: cmp.searchComplete,
        directM: Math.round(d.analysis.totalMetres), directSnap: cmp.direct.route.snapOffsetsM.map((o) => +o.toFixed(1)),
        seatsConsidered: cmp.seatsConsidered, rejections: cmp.rejections.map((r) => r.code),
        alternativeReason: cmp.alternativeReason,
      };
      expect(calls - before).toBeLessThanOrEqual(5);
      if (cmp.alternative) {
        const e = evaluateCandidate(cmp.alternative, byId, prefs);
        useful += 1;
        row.alt = {
          stops: cmp.alternative.stopPlaceIds, totalM: Math.round(e.analysis.totalMetres),
          stretches: e.analysis.stretchesMetres.map(Math.round), fits: e.analysis.withinMappedPreference,
          snap: e.stops.map((s) => +s.snapOffsetMetres.toFixed(1)),
        };
        const back = await routeReturn({
          origin: origin.routingPoint!, destination: dest.routingPoint!,
          outwardStopPlaceIds: cmp.alternative.stopPlaceIds, placesById: byId, route,
        });
        const be = evaluateCandidate(back, byId, prefs);
        row.returnStretches = be.analysis.stretchesMetres.map(Math.round);
        row.completeOuting = joinRoundTrip(e.analysis.stretchesMetres, be.analysis.stretchesMetres).map(Math.round);
      }
      rows.push(row);
    } catch (e) {
      rows.push({ from: origin.name, to: dest.name, calls: calls - before, error: (e as Error).message });
    }
  }
  console.log("LIVE feasibility (real ORS, real OSM)", JSON.stringify({ rows, totalCalls: calls, maxInFlight }, null, 1));
  expect(maxInFlight).toBeLessThanOrEqual(2);
  expect(useful).toBeGreaterThanOrEqual(1);
});
