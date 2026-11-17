import { initialPlanner, plannerReducer, prefsOf, requirementsChanged } from "../src/features/planner/PlannerContext";
import type { PlannerAction, PlannerState } from "../src/features/planner/PlannerContext";
import { evaluateCandidate } from "../shared/routeMetrics";
import { candidate, place } from "./fixtures";

const apply = (s: PlannerState, ...actions: PlannerAction[]) => actions.reduce(plannerReducer, s);

const submittedState = () =>
  apply(
    initialPlanner,
    { type: "setOrigin", id: "node/1" },
    { type: "setDestination", id: "node/2" },
    { type: "submit", requestId: "req-1" },
    { type: "selectRoute", id: "via:node/9" },
  );

describe("planner reducer", () => {
  test("cannot submit without both endpoints", () => {
    expect(apply(initialPlanner, { type: "submit", requestId: "x" }).submitted).toBeNull();
    expect(apply(initialPlanner, { type: "setOrigin", id: "node/1" }, { type: "submit", requestId: "x" }).submitted).toBeNull();
  });

  test("preference changes keep the submitted search, geometry key and selection", () => {
    const before = submittedState();
    const after = apply(before, { type: "setLimit", ft: 450 }, { type: "setLimit", ft: 500 }, { type: "setLimit", ft: 250 });
    // Same revision and request id → same query key → zero new network requests.
    expect(after.submitted).toBe(before.submitted);
    expect(after.selectedRouteId).toBe("via:node/9");
    expect(after.limitFt).toBe(250);
  });

  test("the same routed candidate is re-evaluated locally at the new preference", () => {
    const c = candidate([80, 100], ["node/9"]);
    const places = new Map([["node/9", place({ id: "node/9" })]]);
    const at300 = evaluateCandidate(c, places, prefsOf({ ...initialPlanner, limitFt: 300 }));
    const at350 = evaluateCandidate(c, places, prefsOf({ ...initialPlanner, limitFt: 350 }));
    expect(at300.analysis.withinMappedPreference).toBe(false); // 100 m > 91.44 m
    expect(at350.analysis.withinMappedPreference).toBe(true); // 100 m < 106.68 m
  });

  test("changing the destination invalidates the comparison and selection", () => {
    const after = apply(submittedState(), { type: "setDestination", id: "node/3" });
    expect(after.submitted).toBeNull();
    expect(after.selectedRouteId).toBeNull();
  });

  test("a new submit bumps the revision so a late earlier response cannot match", () => {
    const first = submittedState();
    const second = apply(first, { type: "setDestination", id: "node/3" }, { type: "submit", requestId: "req-2" });
    expect(first.submitted!.revision).toBe(1);
    expect(second.submitted).toMatchObject({ revision: 1, destinationId: "node/3", requestId: "req-2" });
    const third = apply(second, { type: "submit", requestId: "req-3" });
    expect(third.submitted!.revision).toBe(2);
  });

  test("preview exclusion is temporary and separate from persistent exclusions", () => {
    const s = apply(submittedState(), { type: "togglePreview", placeId: "node/9" });
    expect(s.previewWithout).toEqual(["node/9"]);
    expect(s.excludedPlaceIds).toEqual([]);
    expect(prefsOf(s).excludedPlaceIds).toEqual([]);
    expect(apply(s, { type: "togglePreview", placeId: "node/9" }).previewWithout).toEqual([]);
    expect(apply(s, { type: "submit", requestId: "req-4" }).previewWithout).toEqual([]);
  });

  test("a seating requirement change marks the existing search as limited", () => {
    const s = submittedState();
    expect(requirementsChanged(s)).toBe(false);
    const changed = apply(s, { type: "setRequireBackrest", value: true });
    expect(requirementsChanged(changed)).toBe(true);
    expect(changed.submitted).toBe(s.submitted);
  });

  test("limit is clamped to the supported range", () => {
    expect(apply(initialPlanner, { type: "setLimit", ft: 10 }).limitFt).toBe(200);
    expect(apply(initialPlanner, { type: "setLimit", ft: 99999 }).limitFt).toBe(3250);
  });
});
