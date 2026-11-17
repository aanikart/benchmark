import {
  analyzeLegs,
  evaluateCandidate,
  isUsefulAlternative,
  joinRoundTrip,
  mappedStretches,
  plannedStretchFromLastRest,
} from "../shared/routeMetrics";
import { candidate, place, prefs } from "./fixtures";

const byId = (...ps: ReturnType<typeof place>[]) => new Map(ps.map((p) => [p.id, p]));

describe("mapped stretches (synthetic fixtures)", () => {
  test("direct path: total and longest are both 420 m", () => {
    const a = analyzeLegs([420], [false], 300);
    expect(a.totalMetres).toBe(420);
    expect(a.longestMappedStretchMetres).toBe(420);
    expect(a.withinMappedPreference).toBe(false);
  });

  test("one counted rest: [240,270], longest 270, fits 300", () => {
    const e = evaluateCandidate(candidate([240, 270], ["node/1"]), byId(place({ id: "node/1" })), prefs());
    expect(e.analysis.stretchesMetres).toEqual([240, 270]);
    expect(e.analysis.longestMappedStretchMetres).toBe(270);
    expect(e.analysis.withinMappedPreference).toBe(true);
    expect(e.analysis.availability).toBe("unconfirmed");
    expect(e.stops[0]).toMatchObject({ counted: true, approach: "unconfirmed", waypointIndex: 1 });
  });

  test("same route does not fit a 250 m preference", () => {
    const e = evaluateCandidate(
      candidate([240, 270], ["node/1"]),
      byId(place({ id: "node/1" })),
      prefs({ maxStretchM: 250 }),
    );
    expect(e.analysis.withinMappedPreference).toBe(false);
  });

  test("excluded rest: required backrest missing joins into one 510 m stretch", () => {
    const e = evaluateCandidate(
      candidate([240, 270], ["node/1"]),
      byId(place({ id: "node/1", backrest: "unknown" })),
      prefs({ requireBackrest: true }),
    );
    expect(e.analysis.stretchesMetres).toEqual([510]);
    expect(e.stops[0].counted).toBe(false);
    expect(e.stops[0].exclusionReasons).toContain("BACKREST_NOT_MAPPED");
  });

  test("unknown middle stop: first counts, second does not → [150, 350]", () => {
    const e = evaluateCandidate(
      candidate([150, 180, 170], ["node/1", "node/2"]),
      byId(place({ id: "node/1", backrest: "yes" }), place({ id: "node/2", backrest: "unknown" })),
      prefs({ requireBackrest: true, maxStretchM: 400 }),
    );
    expect(e.analysis.stretchesMetres).toEqual([150, 350]);
    expect(e.analysis.longestMappedStretchMetres).toBe(350);
  });

  test("unrounded boundary: 300.4 m does not fit 300 m", () => {
    expect(analyzeLegs([300.4], [false], 300).withinMappedPreference).toBe(false);
    expect(analyzeLegs([300], [false], 300).withinMappedPreference).toBe(true);
  });

  test("preview without a stop joins adjoining distances on the same path", () => {
    const c = candidate([240, 270], ["node/1"]);
    const e = evaluateCandidate(c, byId(place({ id: "node/1" })), prefs(), new Set(["node/1"]));
    expect(e.analysis.stretchesMetres).toEqual([510]);
    expect(e.analysis.totalMetres).toBe(510);
    expect(e.stops[0].exclusionReasons).toEqual(["PREVIEW_WITHOUT_STOP"]);
  });

  test("two rest boundaries within 5 m along the route count once", () => {
    const e = evaluateCandidate(
      candidate([200, 3, 200], ["node/1", "node/2"]),
      byId(place({ id: "node/1" }), place({ id: "node/2" })),
      prefs(),
    );
    expect(e.stops.map((s) => s.counted)).toEqual([true, false]);
    expect(e.stops[1].exclusionReasons).toEqual(["DUPLICATE_ALONG_ROUTE"]);
    expect(e.analysis.stretchesMetres).toEqual([200, 203]);
  });

  test("invalid legs are a validation error, never a zero-distance success", () => {
    expect(() => mappedStretches([], [])).toThrow();
    expect(() => mappedStretches([100, NaN], [false, false])).toThrow();
    expect(() => mappedStretches([100, -1], [false, false])).toThrow();
    expect(() => mappedStretches([100], [false, false])).toThrow();
    expect(() => analyzeLegs([0], [false], 300)).toThrow();
    expect(() => evaluateCandidate(candidate([100], ["node/1"]), new Map(), prefs())).toThrow();
  });
});

describe("useful alternative", () => {
  const a = (longest: number, total: number, pref = 300) => analyzeLegs([longest, total - longest], [true, false], pref);

  test("small improvement that crosses the preference is kept (310 → 290 at 300)", () => {
    const direct = analyzeLegs([310], [false], 300);
    const alt = analyzeLegs([290, 40], [true, false], 300);
    expect(310 - 290).toBeLessThan(25);
    expect(isUsefulAlternative(direct, alt, 1)).toBe(true);
  });

  test("needs at least one counted rest", () => {
    expect(isUsefulAlternative(analyzeLegs([310], [false], 300), analyzeLegs([290], [false], 300), 0)).toBe(false);
  });

  test("otherwise requires min(25 m, 10% of direct)", () => {
    const direct = analyzeLegs([600], [false], 200);
    expect(isUsefulAlternative(direct, a(580, 620, 200), 1)).toBe(false); // 20 m
    expect(isUsefulAlternative(direct, a(575, 620, 200), 1)).toBe(true); // 25 m
    const short = analyzeLegs([100], [false], 50);
    expect(isUsefulAlternative(short, analyzeLegs([90, 20], [true, false], 50), 1)).toBe(true); // 10 m = 10%
  });
});

describe("return and complete outing", () => {
  test("return without a destination rest joins boundary stretches", () => {
    const joined = joinRoundTrip([240, 270], [260, 250]);
    expect(joined).toEqual([240, 530, 250]);
    expect(joined.reduce((x, y) => x + y, 0)).toBe(1020);
    expect(Math.max(...joined)).toBeGreaterThan(300); // both directions fit separately
  });

  test("an eligible rest at the destination keeps them separate", () => {
    expect(joinRoundTrip([240, 270], [260, 250], true)).toEqual([240, 270, 260, 250]);
  });

  test("the same seat outward and returning gives two distinct occurrences in route order", () => {
    const places = byId(place({ id: "node/1" }));
    const out = evaluateCandidate(candidate([240, 270], ["node/1"], "outward"), places, prefs());
    const back = evaluateCandidate(candidate([270, 240], ["node/1"], "return"), places, prefs());
    expect(out.stops[0].occurrenceId).not.toBe(back.stops[0].occurrenceId);
    expect(out.stops[0].counted && back.stops[0].counted).toBe(true);
  });
});

describe("outing guide: reached is not rested", () => {
  const legs = [240, 270];
  const planned = [true, false];

  test("reaching an unusable bench at 240 m gives a 510 m planned stretch", () => {
    expect(plannedStretchFromLastRest(legs, planned, [false, false], 1)).toBe(510);
  });
  test("resting there resets to the next 270 m", () => {
    expect(plannedStretchFromLastRest(legs, planned, [true, false], 1)).toBe(270);
  });
  test("before setting off, the stretch runs to the first planned rest", () => {
    expect(plannedStretchFromLastRest(legs, planned, [false, false], 0)).toBe(240);
  });
  test("invalid state throws", () => {
    expect(() => plannedStretchFromLastRest(legs, planned, [false], 1)).toThrow();
    expect(() => plannedStretchFromLastRest(legs, planned, [false, false], 3)).toThrow();
  });
});
