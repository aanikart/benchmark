import { LIMITS } from "./contracts.ts";
import type { LonLat, Place } from "./contracts.ts";
import { distanceM, lineLengthM, projectOntoLine } from "./geo.ts";

export interface SeatCandidate {
  place: Place;
  point: LonLat;
  alongM: number;
  offsetM: number;
}

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Pool of at most 24 seats near the direct geometry: up to eight per third of its length,
 * ordered by distance from the line, then stable OSM identity. Proximity only selects
 * candidates; it never credits a rest.
 */
export function candidatePool(
  directGeometry: readonly LonLat[],
  eligibleSeats: readonly Place[],
): { pool: SeatCandidate[]; lengthM: number } {
  const lengthM = lineLengthM(directGeometry);
  const all: SeatCandidate[] = [];
  for (const place of eligibleSeats) {
    if (!place.routingPoint) continue;
    const { alongM, offsetM } = projectOntoLine(directGeometry, place.routingPoint);
    if (offsetM <= LIMITS.corridorM) all.push({ place, point: place.routingPoint, alongM, offsetM });
  }
  const pool: SeatCandidate[] = [];
  for (let third = 0; third < 3; third++) {
    const lo = (lengthM * third) / 3;
    const hi = (lengthM * (third + 1)) / 3;
    const inThird = all
      .filter((c) => (third === 2 ? c.alongM >= lo : c.alongM >= lo && c.alongM < hi))
      .sort((a, b) => a.offsetM - b.offsetM || byId(a.place.id, b.place.id))
      .slice(0, LIMITS.perThird);
    pool.push(...inThird);
  }
  return { pool, lengthM };
}

/**
 * Single-seat trial order: smallest estimated longest stretch after splitting at the
 * projection, then straight-line start → seat → destination, then id. Ranking proxies only.
 */
export function rankSingles(
  pool: readonly SeatCandidate[],
  lengthM: number,
  origin: LonLat,
  destination: LonLat,
): SeatCandidate[] {
  const key = (c: SeatCandidate) => ({
    worst: Math.max(c.alongM, lengthM - c.alongM),
    via: distanceM(origin, c.point) + distanceM(c.point, destination),
  });
  return [...pool].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka.worst - kb.worst || ka.via - kb.via || byId(a.place.id, b.place.id);
  });
}

/**
 * Best ordered-by-projection pair from the pool (at most 276 pairs): minimize
 * max(a, b-a, L-b), then straight-line via-pair length, then the pair of ids.
 */
export function bestPair(
  pool: readonly SeatCandidate[],
  lengthM: number,
  origin: LonLat,
  destination: LonLat,
): [SeatCandidate, SeatCandidate] | null {
  let best: { pair: [SeatCandidate, SeatCandidate]; worst: number; via: number; ids: string } | null = null;
  for (let i = 0; i < pool.length; i++) {
    for (let j = 0; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];
      if (i === j || !(a.alongM < b.alongM)) continue;
      const worst = Math.max(a.alongM, b.alongM - a.alongM, lengthM - b.alongM);
      const via = distanceM(origin, a.point) + distanceM(a.point, b.point) + distanceM(b.point, destination);
      const ids = `${a.place.id}|${b.place.id}`;
      if (
        !best ||
        worst < best.worst ||
        (worst === best.worst && (via < best.via || (via === best.via && ids < best.ids)))
      ) {
        best = { pair: [a, b], worst, via, ids };
      }
    }
  }
  return best ? best.pair : null;
}
