import type { ContextArea, LonLat, Place } from "./contracts.ts";
import { distanceM } from "./geo.ts";

/** Ray-casting point-in-polygon on lon/lat; adequate for campus-sized outlines. */
export function inRing(p: LonLat, ring: readonly LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Approximate distance in metres from a point to an outline's edge (equirectangular). */
export function distanceToRingM(p: LonLat, ring: readonly LonLat[]): number {
  const kx = 111_320 * Math.cos((p[1] * Math.PI) / 180);
  const ky = 110_574;
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const ax = (ring[i][0] - p[0]) * kx, ay = (ring[i][1] - p[1]) * ky;
    const bx = (ring[i + 1][0] - p[0]) * kx, by = (ring[i + 1][1] - p[1]) * ky;
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

const KIND_RANK: Record<ContextArea["kind"], number> = { garden: 0, park: 1, complex: 2, building: 3 };

export const areaName = (a: ContextArea) => (a.shortName && a.shortName !== a.name ? `${a.name} (${a.shortName})` : a.name);

/**
 * Where a place is, for telling similar names apart. In order:
 * inside a named garden/park/complex/building → "in …"; within 30 m of one → "by …";
 * a mapped street address; otherwise "near" the closest named everyday place.
 * Derived only from map data; never an invented name.
 */
export function buildPlaceContext(places: readonly Place[], areas: readonly ContextArea[]): Map<string, string> {
  const anchors = places.filter((p) => (p.kind === "library" || p.kind === "cafe" || p.kind === "community_centre") && p.name);
  const out = new Map<string, string>();
  for (const p of places) {
    const own = (a: ContextArea) => a.name.toLowerCase() === (p.name ?? "").toLowerCase();
    const containing = areas
      .filter((a) => !own(a) && inRing(p.displayCoordinate, a.ring))
      .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || (a.id < b.id ? -1 : 1));
    if (containing.length) {
      out.set(p.id, `in ${areaName(containing[0])}`);
      continue;
    }
    let nearest: { a: ContextArea; d: number } | null = null;
    for (const a of areas) {
      if (own(a) || a.kind === "complex") continue;
      const d = distanceToRingM(p.displayCoordinate, a.ring);
      if (d <= 30 && (!nearest || d < nearest.d)) nearest = { a, d };
    }
    if (nearest) {
      out.set(p.id, `by ${areaName(nearest.a)}`);
      continue;
    }
    const street = p.tags["addr:street"];
    if (street) {
      const num = p.tags["addr:housenumber"];
      out.set(p.id, num ? `${num} ${street}` : street);
      continue;
    }
    let best: { name: string; d: number } | null = null;
    for (const a of anchors) {
      if (a.id === p.id || a.name === p.name) continue;
      const d = distanceM(p.displayCoordinate, a.displayCoordinate);
      if (!best || d < best.d) best = { name: a.name!, d };
    }
    if (best) out.set(p.id, `near ${best.name}`);
  }
  return out;
}

export interface PlaceGroup {
  id: string; // the garden's OSM id
  name: string;
  memberIds: readonly string[]; // routable named artworks inside, sorted by name
  /** Suggested arrival point: the member closest to the garden's middle. Shown, never silent. */
  defaultMemberId: string;
}

/** A named garden or park holding three or more routable named artworks becomes one destination. */
export function buildGroups(places: readonly Place[], areas: readonly ContextArea[]): PlaceGroup[] {
  const groups: PlaceGroup[] = [];
  for (const a of areas) {
    if (a.kind !== "garden" && a.kind !== "park") continue;
    const members = places.filter(
      (p) => p.kind === "artwork" && p.name && p.routingPoint && inRing(p.displayCoordinate, a.ring),
    );
    if (members.length < 3) continue;
    // The ring is closed (last vertex repeats the first); count each corner once.
    const corners = a.ring.slice(0, -1);
    const lon = corners.reduce((s, c) => s + c[0], 0) / corners.length;
    const lat = corners.reduce((s, c) => s + c[1], 0) / corners.length;
    const mid: LonLat = [lon, lat];
    const byDist = [...members].sort(
      (x, y) => distanceM(mid, x.displayCoordinate) - distanceM(mid, y.displayCoordinate) || (x.id < y.id ? -1 : 1),
    );
    groups.push({
      id: a.id,
      name: a.name,
      memberIds: [...members].sort((x, y) => x.name!.localeCompare(y.name!) || (x.id < y.id ? -1 : 1)).map((p) => p.id),
      defaultMemberId: byDist[0].id,
    });
  }
  return groups.sort((x, y) => x.name.localeCompare(y.name));
}
