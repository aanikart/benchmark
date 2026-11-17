import { createContext, useContext, useMemo, useReducer } from "react";
import type { Dispatch, ReactNode } from "react";
import type { SeatingPrefs } from "../../../shared/contracts";
import { LIMIT_DEFAULT_FT, LIMIT_MAX_FT, LIMIT_MIN_FT, ftToM } from "../../services/units";

export interface Submitted {
  revision: number;
  requestId: string;
  originId: string;
  destinationId: string;
  /** Requirements the search ran with (the numeric preference is re-evaluated locally). */
  prefs: SeatingPrefs;
}

export interface PlannerState {
  originId: string | null;
  destinationId: string | null;
  /**
   * What the person picked when it is not itself a routable point: a garden grouping its
   * artworks, or a place mapped as a building outline. `destinationId` is then the arrival
   * point they chose (or the suggested one, shown on screen) inside or next to it.
   */
  destinationVia: { id: string; name: string; kind: "group" | "area" } | null;
  limitFt: number;
  requireBackrest: boolean;
  allowPicnicTables: boolean;
  /** Private persistent exclusions (post-walk reports). Separate from previews. */
  excludedPlaceIds: readonly string[];
  submitted: Submitted | null;
  selectedRouteId: string | null;
  /** Temporary "preview without this stop" set. Never persisted, never sent to the server. */
  previewWithout: readonly string[];
}

export type PlannerAction =
  | { type: "setOrigin"; id: string }
  | { type: "setDestination"; id: string; via?: PlannerState["destinationVia"] }
  | { type: "chooseArea"; via: NonNullable<PlannerState["destinationVia"]> }
  | { type: "setLimit"; ft: number }
  | { type: "setRequireBackrest"; value: boolean }
  | { type: "setAllowPicnicTables"; value: boolean }
  | { type: "submit"; requestId: string }
  | { type: "selectRoute"; id: string }
  | { type: "togglePreview"; placeId: string }
  | { type: "reset" };

export const initialPlanner: PlannerState = {
  originId: null,
  destinationId: null,
  destinationVia: null,
  limitFt: LIMIT_DEFAULT_FT,
  requireBackrest: false,
  allowPicnicTables: false,
  excludedPlaceIds: [],
  submitted: null,
  selectedRouteId: null,
  previewWithout: [],
};

export function prefsOf(s: PlannerState): SeatingPrefs {
  return {
    maxStretchM: ftToM(s.limitFt),
    requireBackrest: s.requireBackrest,
    allowPicnicTables: s.allowPicnicTables,
    excludedPlaceIds: s.excludedPlaceIds,
  };
}

export function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case "setOrigin":
      // Changing an endpoint invalidates the selected comparison.
      return { ...state, originId: action.id, submitted: null, selectedRouteId: null, previewWithout: [] };
    case "setDestination":
      return {
        ...state,
        destinationId: action.id,
        destinationVia: action.via ?? null,
        submitted: null,
        selectedRouteId: null,
        previewWithout: [],
      };
    case "chooseArea":
      // No arrival point yet: Find routes stays disabled until the person chooses one.
      return { ...state, destinationId: null, destinationVia: action.via, submitted: null, selectedRouteId: null, previewWithout: [] };
    case "setLimit":
      // Numeric preference only: geometry, selection and previews are retained.
      return { ...state, limitFt: Math.min(LIMIT_MAX_FT, Math.max(LIMIT_MIN_FT, Math.round(action.ft))) };
    case "setRequireBackrest":
      return { ...state, requireBackrest: action.value };
    case "setAllowPicnicTables":
      return { ...state, allowPicnicTables: action.value };
    case "submit":
      if (!state.originId || !state.destinationId) return state;
      return {
        ...state,
        submitted: {
          revision: (state.submitted?.revision ?? 0) + 1,
          requestId: action.requestId,
          originId: state.originId,
          destinationId: state.destinationId,
          prefs: prefsOf(state),
        },
        selectedRouteId: null,
        previewWithout: [],
      };
    case "selectRoute":
      return { ...state, selectedRouteId: action.id };
    case "togglePreview":
      return {
        ...state,
        previewWithout: state.previewWithout.includes(action.placeId)
          ? state.previewWithout.filter((p) => p !== action.placeId)
          : [...state.previewWithout, action.placeId],
      };
    case "reset":
      return initialPlanner;
  }
}

/** True when seating requirements changed since the search ran: results are limited. */
export function requirementsChanged(s: PlannerState): boolean {
  if (!s.submitted) return false;
  return (
    s.submitted.prefs.requireBackrest !== s.requireBackrest ||
    s.submitted.prefs.allowPicnicTables !== s.allowPicnicTables
  );
}

const Ctx = createContext<{ state: PlannerState; dispatch: Dispatch<PlannerAction> } | null>(null);

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(plannerReducer, initialPlanner);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlanner() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlanner must be used inside PlannerProvider");
  return v;
}
