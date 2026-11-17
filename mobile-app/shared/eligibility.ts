import type { Place, SeatingPrefs } from "./contracts.ts";

export type ExclusionReason =
  | "NOT_SEATING"
  | "SEATING_NOT_MAPPED"
  | "PICNIC_TABLES_OFF"
  | "BACKREST_NOT_MAPPED"
  | "BACKREST_NO"
  | "SHELTER_SEAT_BACKREST_UNATTRIBUTED"
  | "SHELTER_TYPE_UNSUITABLE"
  | "ACCESS_RESTRICTED"
  | "ACCESS_UNRESOLVED"
  | "FOOT_NO"
  | "LOCKED"
  | "DISUSED"
  | "TIMED_OR_CONDITIONAL"
  | "INDOOR"
  | "NOT_A_POINT"
  | "PERSONALLY_EXCLUDED"
  | "PREVIEW_WITHOUT_STOP"
  | "DUPLICATE_ALONG_ROUTE";

export interface Eligibility {
  eligible: boolean;
  reasons: readonly ExclusionReason[];
}

const REJECTED_ACCESS = new Set(["no", "private", "customers"]);
const OPEN_ACCESS = new Set(["yes", "permissive"]);
const UNSUITABLE_SHELTERS = new Set(["field_shelter", "basic_hut", "public_transport"]);

/**
 * Can this mapped place divide a mapped walking stretch for this person?
 * This judges mapped attributes only. Routing evidence (explicit waypoint, bounded snap) and
 * physical availability are separate facts and are never implied by a `true` here.
 */
export function seatEligibility(place: Place, prefs: SeatingPrefs): Eligibility {
  const reasons: ExclusionReason[] = [];
  const t = place.tags;

  if (place.role !== "seat") reasons.push("NOT_SEATING");
  else if (place.seating !== "yes") reasons.push("SEATING_NOT_MAPPED");

  if (place.kind === "picnic_table" && !prefs.allowPicnicTables) reasons.push("PICNIC_TABLES_OFF");

  if (place.kind === "shelter" && t.shelter_type && UNSUITABLE_SHELTERS.has(t.shelter_type)) {
    reasons.push("SHELTER_TYPE_UNSUITABLE");
  }

  if (prefs.requireBackrest && place.role === "seat") {
    if (place.kind === "shelter") reasons.push("SHELTER_SEAT_BACKREST_UNATTRIBUTED");
    else if (place.backrest === "no") reasons.push("BACKREST_NO");
    else if (place.backrest !== "yes") reasons.push("BACKREST_NOT_MAPPED");
  }

  if (t.access !== undefined) {
    if (REJECTED_ACCESS.has(t.access)) reasons.push("ACCESS_RESTRICTED");
    else if (!OPEN_ACCESS.has(t.access)) reasons.push("ACCESS_UNRESOLVED");
  }
  if (t.foot === "no") reasons.push("FOOT_NO");
  if (t.locked === "yes") reasons.push("LOCKED");

  const lifecycle = Object.keys(t).some((k) => /^(disused|abandoned|removed|demolished|was):/.test(k));
  if (lifecycle || t.disused === "yes" || t.abandoned === "yes") reasons.push("DISUSED");

  // No hours parser in this version: anything timed or conditional is excluded unless 24/7.
  if ((t.opening_hours !== undefined && t.opening_hours.trim() !== "24/7") || t["access:conditional"] !== undefined) {
    reasons.push("TIMED_OR_CONDITIONAL");
  }

  if (t.indoor === "yes" || t.location === "indoor") reasons.push("INDOOR");
  if (place.coordinateKind !== "node" || place.routingPoint === null) reasons.push("NOT_A_POINT");
  if (prefs.excludedPlaceIds.includes(place.id)) reasons.push("PERSONALLY_EXCLUDED");

  return { eligible: reasons.length === 0, reasons };
}

export const REASON_TEXT: Record<ExclusionReason, string> = {
  NOT_SEATING: "No seating is mapped here",
  SEATING_NOT_MAPPED: "Seating is not mapped here",
  PICNIC_TABLES_OFF: "Picnic tables are turned off in your preferences",
  BACKREST_NOT_MAPPED: "You require a backrest, and a backrest is not mapped",
  BACKREST_NO: "You require a backrest, and this seat is mapped without one",
  SHELTER_SEAT_BACKREST_UNATTRIBUTED: "You require a backrest, and the shelter's seat is not mapped separately",
  SHELTER_TYPE_UNSUITABLE: "This kind of shelter is not counted as a resting place",
  ACCESS_RESTRICTED: "Access is mapped as restricted",
  ACCESS_UNRESOLVED: "Access conditions are unclear in the map data",
  FOOT_NO: "Walking access is mapped as not allowed",
  LOCKED: "Mapped as locked",
  DISUSED: "Mapped as disused or removed",
  TIMED_OR_CONDITIONAL: "Mapped with opening hours or conditions",
  INDOOR: "Mapped as indoors",
  NOT_A_POINT: "Location is approximate (mapped as an area)",
  PERSONALLY_EXCLUDED: "You marked this place as not usable",
  PREVIEW_WITHOUT_STOP: "Previewing the walk without resting here",
  DUPLICATE_ALONG_ROUTE: "Within 5 m of another planned rest on this route",
};
