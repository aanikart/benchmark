import { seatEligibility } from "../shared/eligibility";
import { formatSourceDate, parseEditTimestamp, parseSourceDate } from "../shared/sourceDates";
import { NOW, place, prefs } from "./fixtures";

const reasons = (p: ReturnType<typeof place>, pr = prefs()) => seatEligibility(p, pr).reasons;

describe("seat eligibility (synthetic fixtures)", () => {
  test("plain bench with nothing else mapped is eligible", () => {
    expect(seatEligibility(place({ id: "node/1" }), prefs()).eligible).toBe(true);
  });

  test("required backrest: unknown and no are excluded, yes passes", () => {
    const pr = prefs({ requireBackrest: true });
    expect(reasons(place({ id: "node/1", backrest: "unknown" }), pr)).toEqual(["BACKREST_NOT_MAPPED"]);
    expect(reasons(place({ id: "node/1", backrest: "no" }), pr)).toEqual(["BACKREST_NO"]);
    expect(reasons(place({ id: "node/1", backrest: "yes" }), pr)).toEqual([]);
  });

  test("missing material never excludes a stop", () => {
    expect(reasons(place({ id: "node/1", tags: { amenity: "bench" } }))).toEqual([]);
  });

  test("landmark-only stop: artwork or café never splits a stretch", () => {
    for (const kind of ["artwork", "cafe", "library", "viewpoint"] as const) {
      const p = place({ id: "node/9", role: "landmark", kind, seating: "unknown", tags: {} });
      expect(reasons(p)).toContain("NOT_SEATING");
    }
  });

  test("shelter without seating evidence cannot split; with bench=yes it can", () => {
    const bare = place({ id: "node/2", kind: "shelter", seating: "unknown", tags: { amenity: "shelter" } });
    expect(reasons(bare)).toEqual(["SEATING_NOT_MAPPED"]);
    const seated = place({ id: "node/2", kind: "shelter", seating: "yes", tags: { amenity: "shelter", bench: "yes" } });
    expect(reasons(seated)).toEqual([]);
    expect(reasons(seated, prefs({ requireBackrest: true }))).toEqual(["SHELTER_SEAT_BACKREST_UNATTRIBUTED"]);
    const animal = place({
      id: "node/2", kind: "shelter", seating: "yes",
      tags: { amenity: "shelter", bench: "yes", shelter_type: "field_shelter" },
    });
    expect(reasons(animal)).toEqual(["SHELTER_TYPE_UNSUITABLE"]);
  });

  test("picnic table follows the setting and still needs required attributes", () => {
    const t = place({ id: "node/3", kind: "picnic_table", tags: { leisure: "picnic_table" } });
    expect(reasons(t, prefs({ allowPicnicTables: false }))).toEqual(["PICNIC_TABLES_OFF"]);
    expect(reasons(t, prefs({ allowPicnicTables: true }))).toEqual([]);
    expect(reasons(t, prefs({ allowPicnicTables: true, requireBackrest: true }))).toEqual(["BACKREST_NOT_MAPPED"]);
  });

  test("access restrictions", () => {
    const withTags = (tags: Record<string, string>) => reasons(place({ id: "node/4", tags: { amenity: "bench", ...tags } }));
    for (const v of ["no", "private", "customers"]) expect(withTags({ access: v })).toEqual(["ACCESS_RESTRICTED"]);
    for (const v of ["permit", "destination", "students", "unknown"]) expect(withTags({ access: v })).toEqual(["ACCESS_UNRESOLVED"]);
    expect(withTags({ access: "yes" })).toEqual([]);
    expect(withTags({ foot: "no" })).toEqual(["FOOT_NO"]);
    expect(withTags({ locked: "yes" })).toEqual(["LOCKED"]);
    expect(withTags({ "disused:amenity": "bench" })).toEqual(["DISUSED"]);
    expect(withTags({ opening_hours: "Mo-Fr 08:00-17:00" })).toEqual(["TIMED_OR_CONDITIONAL"]);
    expect(withTags({ opening_hours: "24/7" })).toEqual([]);
    expect(withTags({ "access:conditional": "no @ (22:00-06:00)" })).toEqual(["TIMED_OR_CONDITIONAL"]);
    expect(withTags({ indoor: "yes" })).toEqual(["INDOOR"]);
  });

  test("area center is never a counted seat waypoint", () => {
    const area = place({ id: "way/5", coordinateKind: "area_center", routingPoint: null });
    expect(reasons(area)).toEqual(["NOT_A_POINT"]);
  });

  test("personal exclusion", () => {
    expect(reasons(place({ id: "node/6" }), prefs({ excludedPlaceIds: ["node/6"] }))).toEqual(["PERSONALLY_EXCLUDED"]);
  });
});

describe("source dates", () => {
  test("partial dates keep their precision", () => {
    expect(parseSourceDate("2025-03", NOW).value).toBe("2025-03");
    expect(formatSourceDate("2025-03")).toBe("March 2025");
    expect(formatSourceDate("2025")).toBe("2025");
    expect(formatSourceDate("2025-03-04")).toBe("March 4, 2025");
  });
  test("future and malformed dates are not evidence; raw text is retained", () => {
    expect(parseSourceDate("2027-01-01", NOW)).toEqual({ value: null, raw: "2027-01-01" });
    expect(parseSourceDate("last spring", NOW)).toEqual({ value: null, raw: "last spring" });
    expect(parseSourceDate("2025-13", NOW).value).toBeNull();
    expect(parseSourceDate("2025-02-30", NOW).value).toBeNull();
    expect(parseSourceDate(undefined, NOW)).toEqual({ value: null, raw: null });
  });
  test("missing survey stays missing", () => {
    expect(formatSourceDate(null)).toBe("Not mapped");
  });
  test("edit timestamps reject future values", () => {
    expect(parseEditTimestamp("2025-03-04T10:00:00Z", NOW)).toBe("2025-03-04T10:00:00.000Z");
    expect(parseEditTimestamp("2030-01-01T00:00:00Z", NOW)).toBeNull();
    expect(parseEditTimestamp("nope", NOW)).toBeNull();
  });
});
