/** SYNTHETIC outlines and places, except the final block which uses the recorded real download. */
import rec from "../data/recorded/overpass-stanford.json";
import { buildGroups, buildPlaceContext, inRing } from "../shared/areas";
import type { ContextArea, LonLat } from "../shared/contracts";
import { normalizeOverpass } from "../shared/normalizeOverpass";
import { initialPlanner, plannerReducer } from "../src/features/planner/PlannerContext";
import { FETCHED, NOW, place } from "./fixtures";

const square = (id: string, name: string, kind: ContextArea["kind"], lon: number, lat: number, half = 0.0003): ContextArea => ({
  id, name, kind, shortName: null,
  ring: [[lon - half, lat - half], [lon + half, lat - half], [lon + half, lat + half], [lon - half, lat + half], [lon - half, lat - half]] as LonLat[],
});
const at = (lon: number, lat: number) => ({ displayCoordinate: [lon, lat] as LonLat, routingPoint: [lon, lat] as LonLat });
const art = (id: string, name: string, lon: number, lat: number) =>
  place({ id, role: "landmark", kind: "artwork", name, seating: "unknown", tags: { tourism: "artwork" }, ...at(lon, lat) });
const cafe = (id: string, name: string, lon: number, lat: number, tags: Record<string, string> = {}) =>
  place({ id, role: "landmark", kind: "cafe", name, seating: "unknown", tags: { amenity: "cafe", ...tags }, ...at(lon, lat) });

describe("location labels (synthetic)", () => {
  const garden = square("way/1", "Statue Garden", "garden", -122.17, 37.43);
  const hall = square("way/2", "North Hall", "building", -122.16, 37.42);
  const complex = square("way/3", "Business School", "complex", -122.16, 37.42, 0.001);

  test("inside a garden beats inside a building; complex beats building", () => {
    const ctx = buildPlaceContext([art("node/1", "Bust", -122.17, 37.43), cafe("node/2", "Twin Cafe", -122.16, 37.42)], [garden, hall, complex]);
    expect(ctx.get("node/1")).toBe("in Statue Garden");
    expect(ctx.get("node/2")).toBe("in Business School");
  });

  test("next to an outline says 'by'; otherwise address, otherwise near a named everyday place", () => {
    const ctx = buildPlaceContext(
      [
        cafe("node/3", "Edge Cafe", -122.16 + 0.0005, 37.42), // ~17 m outside North Hall's edge
        cafe("node/4", "Street Cafe", -122.15, 37.40, { "addr:street": "Main Street", "addr:housenumber": "12" }),
        cafe("node/5", "Lonely Cafe", -122.14, 37.40),
      ],
      [hall],
    );
    expect(ctx.get("node/3")).toBe("by North Hall");
    expect(ctx.get("node/4")).toBe("12 Main Street");
    expect(ctx.get("node/5")).toMatch(/^near /);
  });

  test("an outline never labels the place it describes", () => {
    const ctx = buildPlaceContext([cafe("node/6", "North Hall", -122.16, 37.42)], [hall]);
    expect(ctx.get("node/6")).not.toBe("in North Hall");
  });

  test("a garden with three or more routable named artworks becomes one group", () => {
    const pieces = [art("node/11", "C", -122.1701, 37.43), art("node/12", "A", -122.17, 37.43), art("node/13", "B", -122.1699, 37.4301)];
    const groups = buildGroups([...pieces, art("node/14", "Outside", -122.18, 37.43)], [garden]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ name: "Statue Garden", memberIds: ["node/12", "node/13", "node/11"], defaultMemberId: "node/12" });
    expect(buildGroups(pieces.slice(0, 2), [garden])).toHaveLength(0);
  });

  test("point in ring", () => {
    expect(inRing([-122.17, 37.43], garden.ring)).toBe(true);
    expect(inRing([-122.171, 37.43], garden.ring)).toBe(false);
  });
});

describe("outlines from Overpass (synthetic payload)", () => {
  test("closed named ways with geometry become context areas; campus-sized ones are dropped", () => {
    const ring = (lon: number, lat: number, h: number) =>
      [[lon - h, lat - h], [lon + h, lat - h], [lon + h, lat + h], [lon - h, lat + h], [lon - h, lat - h]].map(([lo, la]) => ({ lat: la, lon: lo }));
    const c = normalizeOverpass(
      {
        elements: [
          { type: "way", id: 1, tags: { building: "yes", name: "Hall", short_name: "H" }, geometry: ring(-122.17, 37.43, 0.0002) },
          { type: "way", id: 2, tags: { amenity: "university", name: "Whole Campus" }, geometry: ring(-122.17, 37.43, 0.01) },
          { type: "way", id: 3, tags: { building: "yes" }, geometry: ring(-122.17, 37.43, 0.0002) },
          { type: "way", id: 4, tags: { building: "yes", name: "Open" }, geometry: ring(-122.17, 37.43, 0.0002).slice(0, 4) },
        ],
      },
      { regionId: "stanford", queryVersion: 2, fetchedAt: FETCHED, origin: "live", now: NOW },
    );
    expect(c.areas.map((a) => [a.id, a.name, a.shortName, a.kind])).toEqual([["way/1", "Hall", "H", "building"]]);
    expect(c.places).toHaveLength(0);
  });
});

describe("planner: grouped and outlined destinations", () => {
  test("choosing an outlined place leaves no routable destination until an arrival point is picked", () => {
    const via = { id: "way/9", name: "Green Library Café", kind: "area" as const };
    const s = plannerReducer(plannerReducer(initialPlanner, { type: "setOrigin", id: "node/1" }), { type: "chooseArea", via });
    expect(s.destinationId).toBeNull();
    expect(plannerReducer(s, { type: "submit", requestId: "x" }).submitted).toBeNull();
    const chosen = plannerReducer(s, { type: "setDestination", id: "node/2", via });
    expect(chosen).toMatchObject({ destinationId: "node/2", destinationVia: via });
    expect(plannerReducer(chosen, { type: "setDestination", id: "node/3" }).destinationVia).toBeNull();
  });
});

describe("recorded real download (see provenance in the file)", () => {
  const c = normalizeOverpass(rec.response, { regionId: "stanford", queryVersion: 2, fetchedAt: rec.provenance.recordedAt, origin: "recorded", now: new Date() });
  const ctx = buildPlaceContext(c.places, c.areas);
  test("the campus Coupa locations are told apart", () => {
    const coupas = c.places.filter((p) => p.kind === "cafe" && /coupa/i.test(p.name ?? ""));
    const labels = coupas.map((p) => ctx.get(p.id));
    expect(new Set(labels).size).toBe(coupas.length);
    expect(labels).toEqual(expect.arrayContaining([
      expect.stringContaining("Knight Management Center"),
      expect.stringContaining("Green Library"),
      expect.stringContaining("Huang Engineering Center"),
    ]));
  });
  test("the Rodin sculptures form one destination", () => {
    const g = buildGroups(c.places, c.areas).find((x) => x.name === "Rodin Sculpture Garden");
    expect(g?.memberIds.length).toBeGreaterThanOrEqual(10);
  });
});
