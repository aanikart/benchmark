import type { CandidateRoute, Place, SeatingPrefs } from "../../../shared/contracts";
import { REASON_TEXT } from "../../../shared/eligibility";
import type { ExclusionReason } from "../../../shared/eligibility";
import { evaluateCandidate } from "../../../shared/routeMetrics";
import type { CandidateEvaluation } from "../../../shared/routeMetrics";
import { formatSourceDate } from "../../../shared/sourceDates";
import { fmtFt } from "../../services/units";

const KIND_LABEL: Record<Place["kind"], string> = {
  bench: "Bench",
  picnic_table: "Picnic table",
  shelter: "Shelter",
  artwork: "Artwork",
  viewpoint: "Viewpoint",
  library: "Library",
  cafe: "Café",
  community_centre: "Community center",
};
const KIND_ICON = {
  bench: "bench", picnic_table: "table-picnic", shelter: "home-roof", artwork: "palette", viewpoint: "binoculars",
  library: "bookshelf", cafe: "coffee", community_centre: "account-group",
} as const satisfies Record<Place["kind"], string>;

const KIND_TONE = {
  bench: "seat", picnic_table: "seat", shelter: "seat", artwork: "art", viewpoint: "art",
  library: "library", cafe: "cafe", community_centre: "community",
} as const satisfies Record<Place["kind"], import("../../theme/tokens").Tone>;
export const kindTone = (p: Place) => KIND_TONE[p.kind];

export const kindLabel = (p: Place) => KIND_LABEL[p.kind];
export const kindIcon = (p: Place) => KIND_ICON[p.kind];
/** Source name, or a neutral label. Never an invented local name. */
export const placeLabel = (p: Place | undefined) =>
  !p ? "Unknown place" : (p.name ?? `Mapped ${KIND_LABEL[p.kind].toLowerCase()}`);

/** Short type line, with the artist for artworks when mapped. */
export function kindLine(p: Place): string {
  const artist = p.kind === "artwork" ? p.tags.artist_name : undefined;
  return artist ? `Artwork · ${artist}` : KIND_LABEL[p.kind];
}

export const known = (v: "yes" | "no" | "unknown") => (v === "yes" ? "Yes" : v === "no" ? "No" : "Not mapped");

export function seatSummary(p: Place): string {
  const back = p.backrest === "yes" ? "Has a backrest" : p.backrest === "no" ? "No backrest" : "Backrest unknown";
  const edited = p.sourceEditedAt ? ` · Map edited ${formatSourceDate(p.sourceEditedAt.slice(0, 7))}` : "";
  return back + edited;
}

export const reasonText = (r: string) => REASON_TEXT[r as ExclusionReason] ?? "Not counted";

export interface RouteCardModel {
  id: string;
  title: string;
  evaluation: CandidateEvaluation;
  countedStops: number;
  uncountedStops: number;
  tradeoff: string;
  a11ySummary: string;
}

/** One derived view model per candidate: card, timeline and screen-reader text share it. */
export function routeCardModel(
  candidate: CandidateRoute,
  direct: CandidateRoute,
  placesById: ReadonlyMap<string, Place>,
  prefs: SeatingPrefs,
  previewWithout: ReadonlySet<string>,
): RouteCardModel {
  const evaluation = evaluateCandidate(candidate, placesById, prefs, previewWithout);
  const { analysis, stops } = evaluation;
  const counted = stops.filter((s) => s.counted).length;
  const uncounted = stops.length - counted;
  const isDirect = candidate.kind === "direct";
  const title = isDirect
    ? "Straight there"
    : `Via ${placeLabel(placesById.get(candidate.stopPlaceIds[0])).replace(/^Mapped /, "a mapped ")}` +
      (candidate.stopPlaceIds.length > 1 ? " + 1 more" : "");

  let tradeoff: string;
  if (isDirect) {
    tradeoff = analysis.withinMappedPreference
      ? "The quickest way there, and short enough that you won't need a pause."
      : "The quickest way there, but there's no bench to stop at along the way.";
  } else {
    const extra = analysis.totalMetres - direct.route.totalMetres;
    const seats = counted === 1 ? "a bench to pause at" : `${counted} benches to pause at`;
    const head =
      counted === 0
        ? "None of the stops on this way count as a rest with your current settings."
        : extra < 1
          ? `No extra walking, and you get ${seats} on the way.`
          : `A ${fmtFt(extra)} detour that gives you ${seats}.`;
    tradeoff = analysis.withinMappedPreference || counted === 0
      ? head
      : `${head} One stretch is still longer than you'd like.`;
  }

  const a11ySummary =
    `${title}. About ${fmtFt(analysis.totalMetres)} in all. Longest stretch without a pause about ` +
    `${fmtFt(analysis.longestMappedStretchMetres)}, ` +
    `${analysis.withinMappedPreference ? "within" : "longer than"} your pause distance. ` +
    (counted ? `${counted} bench stop${counted === 1 ? "" : "s"}. ` : "No bench stops. ") +
    "Benches are from map data and aren't confirmed.";

  return { id: candidate.id, title, evaluation, countedStops: counted, uncountedStops: uncounted, tradeoff, a11ySummary };
}

/** "The Walking Man in Rodin Sculpture Garden" when arriving inside a grouped/outlined place. */
export function destinationLabel(p: Place | undefined, via: { name: string } | null): string {
  if (!via) return placeLabel(p);
  return p ? `${placeLabel(p)}, ${via.name}` : via.name;
}
