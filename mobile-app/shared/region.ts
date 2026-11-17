// The one supported discovery area. A search boundary, not a claim of verified accessibility.
export interface Region {
  id: string;
  label: string;
  south: number;
  west: number;
  north: number;
  east: number;
}

export const STANFORD: Region = {
  id: "stanford",
  label: "Stanford campus",
  south: 37.42,
  west: -122.18,
  north: 37.435,
  east: -122.16,
};

export const REGIONS: Readonly<Record<string, Region>> = { [STANFORD.id]: STANFORD };

export function inRegion(region: Region, [lon, lat]: readonly [number, number]) {
  return lat >= region.south && lat <= region.north && lon >= region.west && lon <= region.east;
}

/**
 * Bounded Overpass query generated only from configured numbers (never caller-supplied QL).
 * Output 1: seats and named landmarks (`out meta center`).
 * Output 2: named building / garden / park / campus outlines (`out tags geom`), used only to
 * describe where a place is ("in Knight Management Center") and to group a garden's artworks.
 * Outlines are never routing points.
 */
export function overpassQuery(r: Region): string {
  const bbox = `(${r.south},${r.west},${r.north},${r.east})`;
  return [
    "[out:json][timeout:25];",
    "(",
    `  nwr["amenity"="bench"]${bbox};`,
    `  nwr["leisure"="picnic_table"]${bbox};`,
    `  nwr["amenity"="shelter"]${bbox};`,
    `  node["tourism"~"^(artwork|viewpoint)$"]["name"]${bbox};`,
    `  nwr["amenity"~"^(library|cafe|community_centre)$"]["name"]${bbox};`,
    ");",
    "out meta center;",
    "(",
    `  way["building"]["name"]${bbox};`,
    `  way["leisure"~"^(garden|park)$"]["name"]${bbox};`,
    `  way["amenity"~"^(college|university|library)$"]["name"]${bbox};`,
    ");",
    "out tags geom;",
  ].join("\n");
}

export const QUERY_VERSION = 2;
