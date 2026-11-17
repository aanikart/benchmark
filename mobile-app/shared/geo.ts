// Single adapter for Turf: explicit metre units and the v7 property names live here only.
import distance from "@turf/distance";
import { lineString, point } from "@turf/helpers";
import length from "@turf/length";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import type { LonLat } from "./contracts.ts";

export function distanceM(a: LonLat, b: LonLat): number {
  return distance(point([a[0], a[1]]), point([b[0], b[1]]), { units: "meters" });
}

export function lineLengthM(coords: readonly LonLat[]): number {
  return length(lineString(coords.map((c) => [c[0], c[1]])), { units: "meters" });
}

export interface Projection {
  /** Distance along the line from its start, in metres. */
  alongM: number;
  /** Straight-line distance from the point to the line, in metres. */
  offsetM: number;
}

export function projectOntoLine(coords: readonly LonLat[], p: LonLat): Projection {
  const snapped = nearestPointOnLine(
    lineString(coords.map((c) => [c[0], c[1]])),
    point([p[0], p[1]]),
    { units: "meters" },
  );
  const props = snapped.properties as {
    totalDistance?: number;
    pointDistance?: number;
    location?: number;
    dist?: number;
  };
  const alongM = props.totalDistance ?? props.location;
  const offsetM = props.pointDistance ?? props.dist;
  if (typeof alongM !== "number" || typeof offsetM !== "number") {
    throw new Error("Unexpected nearestPointOnLine result shape");
  }
  return { alongM, offsetM };
}
