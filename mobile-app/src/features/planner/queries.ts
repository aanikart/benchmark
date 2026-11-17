import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Place } from "../../../shared/contracts";
import { buildGroups, buildPlaceContext } from "../../../shared/areas";
import { fetchComparison, fetchPlaces, REGION_ID } from "../../services/outingApi";
import type { Submitted } from "./PlannerContext";

// No account yet: personal query keys carry this owner so they can be dropped on identity change.
export const OWNER = "this-phone";

export function useCatalog() {
  const q = useQuery({
    queryKey: ["catalog", REGION_ID],
    queryFn: ({ signal }) => fetchPlaces(signal),
    staleTime: 10 * 60 * 1000,
  });
  const placesById = useMemo(
    () => new Map<string, Place>((q.data?.catalog.places ?? []).map((p) => [p.id, p])),
    [q.data],
  );
  const placeContext = useMemo(
    () => buildPlaceContext(q.data?.catalog.places ?? [], q.data?.catalog.areas ?? []),
    [q.data],
  );
  const groups = useMemo(() => buildGroups(q.data?.catalog.places ?? [], q.data?.catalog.areas ?? []), [q.data]);
  return {
    ...q,
    catalog: q.data?.catalog ?? null,
    serviceUnreachable: q.data?.serviceUnreachable ?? false,
    placesById,
    placeContext,
    groups,
  };
}

export function useComparison(submitted: Submitted | null) {
  return useQuery({
    // The revision is part of the key, so a late response for an earlier destination can
    // never replace the current draft's result.
    queryKey: ["comparison", OWNER, submitted?.revision, submitted?.originId, submitted?.destinationId],
    enabled: submitted !== null,
    queryFn: ({ signal }) =>
      fetchComparison(
        {
          requestId: submitted!.requestId,
          origin: { placeId: submitted!.originId },
          destination: { placeId: submitted!.destinationId },
          prefs: submitted!.prefs,
        },
        signal,
      ),
    // Explicit Retry only: failures must not multiply provider calls.
    retry: false,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
