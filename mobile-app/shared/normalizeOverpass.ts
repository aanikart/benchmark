import { z } from "zod";
import type { Catalog, ContextArea, KnownBoolean, LonLat, Place, PlaceKind } from "./contracts.ts";
import { distanceM } from "./geo.ts";
import { parseEditTimestamp, parseSourceDate } from "./sourceDates.ts";

export const OVERPASS_MAX_BYTES = 2 * 1024 * 1024;
export const OVERPASS_MAX_ELEMENTS = 2000;

export class DiscoveryError extends Error {
  constructor(
    readonly code:
      | "BAD_STATUS"
      | "BAD_CONTENT_TYPE"
      | "MALFORMED"
      | "PARTIAL"
      | "TOO_LARGE"
      | "TOO_MANY_ELEMENTS",
    message: string,
  ) {
    super(message);
    this.name = "DiscoveryError";
  }
}

const elementSchema = z.object({
  type: z.enum(["node", "way", "relation"]),
  id: z.number().int().nonnegative(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  center: z.object({ lat: z.number(), lon: z.number() }).optional(),
  geometry: z.array(z.object({ lat: z.number(), lon: z.number() }).nullable()).optional(),
  timestamp: z.string().optional(),
  version: z.number().optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

const responseSchema = z.object({
  osm3s: z.object({ timestamp_osm_base: z.string().optional() }).optional(),
  remark: z.string().optional(),
  elements: z.array(z.unknown()),
});

/** Validate the transport-level response before parsing. HTTP 200 alone is not success. */
export function checkOverpassTransport(status: number, contentType: string | null, bodyBytes: number) {
  if (status !== 200) throw new DiscoveryError("BAD_STATUS", `Overpass returned HTTP ${status}`);
  if (!contentType || !contentType.toLowerCase().includes("application/json")) {
    throw new DiscoveryError("BAD_CONTENT_TYPE", `Unexpected content type ${contentType}`);
  }
  if (bodyBytes > OVERPASS_MAX_BYTES) {
    throw new DiscoveryError("TOO_LARGE", "The area returned too much data and needs narrowing");
  }
}

function threeState(v: string | undefined): KnownBoolean {
  // Never Boolean(tag): the string "no" is truthy.
  return v === "yes" ? "yes" : v === "no" ? "no" : "unknown";
}

function kindOf(tags: Record<string, string>): PlaceKind | null {
  if (tags.amenity === "bench") return "bench";
  if (tags.leisure === "picnic_table") return "picnic_table";
  if (tags.amenity === "shelter") return "shelter";
  if (tags.tourism === "artwork") return "artwork";
  if (tags.tourism === "viewpoint") return "viewpoint";
  if (tags.amenity === "library") return "library";
  if (tags.amenity === "cafe") return "cafe";
  if (tags.amenity === "community_centre") return "community_centre";
  return null;
}

const SEAT_KINDS: readonly PlaceKind[] = ["bench", "picnic_table", "shelter"];
const KIND_PRIORITY: Record<string, number> = { bench: 0, picnic_table: 1, shelter: 2 };

// Only tags the app reads are retained.
const KEPT_TAGS = [
  "amenity", "leisure", "tourism", "name", "backrest", "armrest", "material", "seats",
  "access", "access:conditional", "foot", "locked", "opening_hours", "indoor", "location",
  "level", "bench", "picnic_table", "shelter_type", "covered", "disused", "abandoned",
  "check_date", "survey:date", "artwork_type", "wheelchair",
  "artist_name", "addr:housenumber", "addr:street",
];

/**
 * Normalize an Overpass JSON document into the place catalog.
 * Throws DiscoveryError for partial/malformed results so a failed refresh never replaces a cache.
 */
export function normalizeOverpass(
  json: unknown,
  opts: { regionId: string; queryVersion: number; fetchedAt: string; origin: "live" | "recorded"; now: Date },
): Catalog {
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) throw new DiscoveryError("MALFORMED", "Overpass response has an unexpected shape");
  if (parsed.data.remark) {
    // e.g. "runtime error: Query timed out": a 200 with a remark is not an empty success.
    throw new DiscoveryError("PARTIAL", `Overpass remark: ${parsed.data.remark}`);
  }
  if (parsed.data.elements.length > OVERPASS_MAX_ELEMENTS) {
    throw new DiscoveryError("TOO_MANY_ELEMENTS", "The area returned too many objects and needs narrowing");
  }

  const places: Place[] = [];
  const areas = new Map<string, ContextArea>();
  for (const raw of parsed.data.elements) {
    const el = elementSchema.safeParse(raw);
    if (!el.success) throw new DiscoveryError("MALFORMED", "Overpass element has an unexpected shape");
    const e = el.data;
    const tags = e.tags ?? {};
    if (e.geometry) {
      const area = toContextArea(e.type, e.id, tags, e.geometry);
      if (area) areas.set(area.id, area);
      continue;
    }
    const kind = kindOf(tags);
    if (!kind) continue;

    const isNode = e.type === "node";
    const lat = isNode ? e.lat : e.center?.lat;
    const lon = isNode ? e.lon : e.center?.lon;
    if (
      typeof lat !== "number" || typeof lon !== "number" ||
      !Number.isFinite(lat) || !Number.isFinite(lon) ||
      Math.abs(lat) > 90 || Math.abs(lon) > 180
    ) {
      continue; // no usable coordinate: not discoverable
    }
    const coordinate = [lon, lat] as const;
    const isSeatKind = SEAT_KINDS.includes(kind);

    let seating: KnownBoolean = "unknown";
    if (kind === "bench" || kind === "picnic_table") seating = "yes";
    else if (kind === "shelter") {
      if (tags.bench === "yes" || tags.picnic_table === "yes") seating = "yes";
      else if (tags.bench === "no" && tags.picnic_table !== "yes") seating = "no";
    }

    const kept: Record<string, string> = {};
    for (const k of KEPT_TAGS) if (tags[k] !== undefined) kept[k] = tags[k];
    for (const k of Object.keys(tags)) {
      if (/^(disused|abandoned|removed|demolished|was):/.test(k)) kept[k] = tags[k];
      if (/^check_date:/.test(k)) kept[k] = tags[k];
    }

    places.push({
      id: `${e.type}/${e.id}`,
      role: isSeatKind ? "seat" : "landmark",
      kind,
      name: tags.name?.trim() ? tags.name.trim() : null,
      displayCoordinate: coordinate,
      coordinateKind: isNode ? "node" : "area_center",
      // A way/relation center is a bounding-box center, not an entrance or a point on a path.
      routingPoint: isNode ? coordinate : null,
      tags: kept,
      seating,
      // Shelter-level backrest is not attributable to a particular seat.
      backrest: kind === "shelter" ? "unknown" : threeState(tags.backrest),
      armrest: kind === "shelter" ? "unknown" : threeState(tags.armrest),
      sourceVersion: typeof e.version === "number" ? e.version : null,
      sourceEditedAt: parseEditTimestamp(e.timestamp, opts.now),
      mappedCheckDate: parseSourceDate(tags.check_date, opts.now).value,
      mappedSurveyDate: parseSourceDate(tags["survey:date"], opts.now).value,
      fetchedAt: opts.fetchedAt,
      alsoMappedAs: [],
    });
  }

  places.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    regionId: opts.regionId,
    queryVersion: opts.queryVersion,
    fetchedAt: opts.fetchedAt,
    osmBase: parsed.data.osm3s?.timestamp_osm_base ?? null,
    origin: opts.origin,
    complete: true,
    places: mergeDuplicateLandmarks(mergeCoincidentSeats(places)),
    areas: [...areas.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
  };
}

/** Outlines larger than this (e.g. the whole university) describe nothing useful. */
const MAX_AREA_DIAGONAL_M = 1200;

function toContextArea(
  type: string,
  id: number,
  tags: Record<string, string>,
  geometry: readonly ({ lat: number; lon: number } | null)[],
): ContextArea | null {
  const name = tags.name?.trim();
  if (type !== "way" || !name) return null;
  const ring: LonLat[] = [];
  for (const g of geometry) {
    if (!g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon)) return null;
    ring.push([g.lon, g.lat] as const);
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (ring.length < 4 || first[0] !== last[0] || first[1] !== last[1]) return null; // not a closed outline
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const diag = distanceM([Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]);
  if (diag > MAX_AREA_DIAGONAL_M) return null;
  const kind: ContextArea["kind"] =
    tags.leisure === "garden" ? "garden"
    : tags.leisure === "park" ? "park"
    : tags.amenity === "college" || tags.amenity === "university" ? (tags.building ? "building" : "complex")
    : "building";
  return { id: `way/${id}`, name, shortName: tags.short_name?.trim() || null, kind, ring };
}

/**
 * A shelter and a separately mapped bench can describe one apparent seating opportunity.
 * Keep one candidate per location (within 5 m) and preserve the other source references.
 * Only merges across different kinds; two adjacent benches stay separate here and are
 * handled by the along-route duplicate rule instead.
 */
export function mergeCoincidentSeats(places: readonly Place[]): Place[] {
  const seats = places.filter((p) => p.role === "seat" && p.routingPoint && p.seating === "yes");
  const absorbed = new Map<string, string>(); // absorbed id -> keeper id
  const extra = new Map<string, string[]>();
  const ordered = [...seats].sort(
    (a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] || (a.id < b.id ? -1 : 1),
  );
  for (let i = 0; i < ordered.length; i++) {
    const keeper = ordered[i];
    if (absorbed.has(keeper.id)) continue;
    for (let j = i + 1; j < ordered.length; j++) {
      const other = ordered[j];
      if (absorbed.has(other.id) || other.kind === keeper.kind) continue;
      // Cheap latitude prefilter before the geodesic distance.
      if (Math.abs(other.displayCoordinate[1] - keeper.displayCoordinate[1]) > 0.0001) continue;
      if (distanceM(keeper.displayCoordinate, other.displayCoordinate) <= 5) {
        absorbed.set(other.id, keeper.id);
        extra.set(keeper.id, [...(extra.get(keeper.id) ?? []), other.id]);
      }
    }
  }
  return places
    .filter((p) => !absorbed.has(p.id))
    .map((p) => (extra.has(p.id) ? { ...p, alsoMappedAs: extra.get(p.id)! } : p));
}

/**
 * A named landmark is sometimes mapped twice a few metres apart (e.g. a statue pair, or a
 * building and its entrance point). Same name + same kind within 25 m is treated as one
 * destination; the lowest id is kept and the others are preserved as source references.
 */
export function mergeDuplicateLandmarks(places: readonly Place[]): Place[] {
  const absorbed = new Set<string>();
  const extra = new Map<string, string[]>();
  const landmarks = places
    .filter((p) => p.role === "landmark" && p.name && p.routingPoint)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  for (let i = 0; i < landmarks.length; i++) {
    const keeper = landmarks[i];
    if (absorbed.has(keeper.id)) continue;
    for (let j = i + 1; j < landmarks.length; j++) {
      const other = landmarks[j];
      if (absorbed.has(other.id) || other.kind !== keeper.kind) continue;
      if (other.name!.toLowerCase() !== keeper.name!.toLowerCase()) continue;
      if (distanceM(keeper.displayCoordinate, other.displayCoordinate) <= 25) {
        absorbed.add(other.id);
        extra.set(keeper.id, [...(extra.get(keeper.id) ?? []), other.id]);
      }
    }
  }
  return places
    .filter((p) => !absorbed.has(p.id))
    .map((p) => (extra.has(p.id) ? { ...p, alsoMappedAs: [...p.alsoMappedAs, ...extra.get(p.id)!] } : p));
}
