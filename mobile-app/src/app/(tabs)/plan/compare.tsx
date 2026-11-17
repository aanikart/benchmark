import { useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Place } from "../../../../shared/contracts";
import { distanceM } from "../../../../shared/geo";
import { Ribbon } from "../../../components/Ribbon";
import { Attribution, Box, Card, Chip, Icon, LimitStepper, Notice, SecondaryButton, StatTile, StatusBadge, TextButton } from "../../../components/ui";
import { prefsOf, requirementsChanged, usePlanner } from "../../../features/planner/PlannerContext";
import { useCatalog, useComparison } from "../../../features/planner/queries";
import { placeLabel, reasonText, routeCardModel } from "../../../features/planner/viewModel";
import type { RouteCardModel } from "../../../features/planner/viewModel";
import { ApiError, newRequestId } from "../../../services/outingApi";
import { fmtFt } from "../../../services/units";
import { colors, space, type } from "../../../theme/tokens";

const NO_ALT_TEXT: Record<string, string> = {
  NO_ELIGIBLE_SEATS: "No suitable mapped seating found in this search.",
  NONE_USEFUL: "None of the routes checked through mapped seats shortens the longest stretch.",
  ALL_REJECTED: "The seats checked couldn't be reached on mapped paths within the supported tolerance.",
  SEARCH_INCOMPLETE: "Alternative search incomplete.",
};

export default function CompareRoutes() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state, dispatch } = usePlanner();
  const { placesById, catalog } = useCatalog();
  const { submitted } = state;
  const cmp = useComparison(submitted);
  const [editing, setEditing] = useState(false);

  const prefs = prefsOf(state);
  const preview = useMemo(() => new Set(state.previewWithout), [state.previewWithout]);
  const destination = submitted ? placesById.get(submitted.destinationId) : undefined;

  // Preference changes re-derive these locally; no network call.
  const cards = useMemo(() => {
    if (!cmp.data) return [];
    const list = [cmp.data.direct, ...(cmp.data.alternative ? [cmp.data.alternative] : [])];
    return list.map((c) => ({ candidate: c, model: routeCardModel(c, cmp.data!.direct, placesById, prefs, preview) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmp.data, placesById, state.limitFt, state.requireBackrest, state.allowPicnicTables, preview]);

  // One concise announcement after a new result settles.
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (cmp.data && announced.current !== cmp.data.requestId && cards.length) {
      announced.current = cmp.data.requestId;
      AccessibilityInfo.announceForAccessibility(
        `${cards.length} route${cards.length === 1 ? "" : "s"} found. ${cards.map((c) => c.model.a11ySummary).join(" ")}`,
      );
    }
  }, [cmp.data, cards]);

  if (!submitted) {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>This comparison is no longer available.</Text>
        <SecondaryButton label="Build this plan again" onPress={() => router.replace("/plan")} />
      </View>
    );
  }

  const resubmit = () => dispatch({ type: "submit", requestId: newRequestId() });
  const anyFits = cards.some((c) => c.model.evaluation.analysis.withinMappedPreference);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: `Routes to ${state.destinationVia?.name ?? placeLabel(destination)}` }} />

      <Card style={{ gap: space.md }}>
        <View style={styles.limitRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.limitLabel}>YOUR LIMIT BEFORE A REST</Text>
            <Text style={styles.limitValue}>{state.limitFt} ft</Text>
          </View>
          <TextButton
            label={editing ? "Done" : "Edit"}
            icon={editing ? "checkmark-circle" : "create-outline"}
            accessibilityLabel={editing ? "Done editing your limit" : "Edit your limit"}
            onPress={() => setEditing((v) => !v)}
          />
        </View>
        {editing ? <LimitStepper valueFt={state.limitFt} onChange={(ft) => dispatch({ type: "setLimit", ft })} /> : null}
      </Card>

      {cmp.isPending ? (
        <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Finding routes">
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.body}>Finding walking routes and places to sit…</Text>
        </View>
      ) : null}

      {cmp.isError ? (
        <ErrorState
          error={cmp.error}
          origin={placesById.get(submitted.originId)}
          destination={destination}
          places={catalog?.places ?? []}
          onRetry={() => cmp.refetch()}
          onPick={(which, id) => {
            dispatch({ type: which === "origin" ? "setOrigin" : "setDestination", id });
            dispatch({ type: "submit", requestId: newRequestId() });
          }}
        />
      ) : null}

      {cmp.data ? (
        <>
          {requirementsChanged(state) ? (
            <Notice action={<SecondaryButton label="Find other stops" onPress={resubmit} />}>
              Your seating requirements changed after this search. These results are limited to the stops already checked.
            </Notice>
          ) : null}
          {!cmp.data.searchComplete ? (
            <Notice action={<SecondaryButton label="Retry search" onPress={() => { queryClient.removeQueries({ queryKey: ["comparison"] }); resubmit(); }} />}>
              Alternative search incomplete. The routes shown are the ones that finished.
            </Notice>
          ) : null}
          {catalog && Date.now() - Date.parse(cmp.data.catalogFetchedAt) > 24 * 3600 * 1000 ? (
            <Notice>
              Place data was downloaded more than a day ago, so this comparison may be incomplete.
            </Notice>
          ) : null}

          {cards.map(({ candidate, model }) => (
            <RouteCard
              key={model.id}
              model={model}
              placesById={placesById}
              counted={model.evaluation.stops.map((s) => s.counted)}
              directTotal={cmp.data!.direct.route.totalMetres}
              onView={() => {
                dispatch({ type: "selectRoute", id: candidate.id });
                router.push("/plan/steps");
              }}
            />
          ))}

          {!cmp.data.alternative ? (
            <Box>
              <Text style={styles.body}>{NO_ALT_TEXT[cmp.data.alternativeReason ?? "NONE_USEFUL"]}</Text>
              <Text style={styles.support}>
                Only a limited set of nearby seats was checked. Try a closer destination or review your seating requirements.
              </Text>
            </Box>
          ) : null}
          {cards.length > 0 && !anyFits ? (
            <Text style={styles.support}>None of the routes checked has mapped stretches this short.</Text>
          ) : null}

          <Text style={styles.footnote}>
            Distances follow mapped paths. Whether a seat is there and usable today, and the last few steps to it, aren't confirmed.
          </Text>
          <Attribution lines={[cmp.data.direct.route.attribution]} />
        </>
      ) : null}
    </ScrollView>
  );
}

function ErrorState({
  error, origin, destination, places, onRetry, onPick,
}: {
  error: unknown;
  origin: Place | undefined;
  destination: Place | undefined;
  places: readonly Place[];
  onRetry: () => void;
  onPick: (which: "origin" | "destination", id: string) => void;
}) {
  const e = error instanceof ApiError ? error : new ApiError("SOURCE_UNAVAILABLE", "Something went wrong.");
  if (e.code === "NO_ROUTABLE_POINT" && e.failedEndpoints.length > 0) {
    return (
      <View style={{ gap: space.md }}>
        {e.failedEndpoints.map((which) => {
          const failed = which === "origin" ? origin : destination;
          const other = which === "origin" ? destination : origin;
          if (!failed) return null;
          // Unverified nearby point choices; nothing is routed until the person picks one.
          const nearby = places
            .filter((p) => p.role === "landmark" && p.routingPoint && p.id !== failed.id && p.id !== other?.id)
            .map((p) => ({ p, d: distanceM(failed.displayCoordinate, p.displayCoordinate) }))
            .sort((a, b) => a.d - b.d || a.p.id.localeCompare(b.p.id))
            .slice(0, 3);
          return (
            <Notice
              key={which}
              action={
                <View style={{ gap: space.sm }}>
                  {nearby.map(({ p, d }) => (
                    <SecondaryButton
                      key={p.id}
                      label={`${placeLabel(p)} · ~${fmtFt(d)} away`}
                      onPress={() => onPick(which, p.id)}
                    />
                  ))}
                </View>
              }
            >
              {`${placeLabel(failed)} is mapped too far from a walking path to plan ${which === "origin" ? "from" : "to"} directly. ` +
                "Choose a nearby point instead (not yet checked):"}
            </Notice>
          );
        })}
      </View>
    );
  }
  const wait = e.code === "RATE_LIMITED" && e.retryAfterSeconds ? ` Try again in about ${e.retryAfterSeconds} seconds.` : "";
  return (
    <Notice action={<SecondaryButton label="Retry" onPress={onRetry} />}>
      {e.message + wait} Your plan is still here.
    </Notice>
  );
}

function RouteCard({
  model, placesById, counted, directTotal, onView,
}: {
  model: RouteCardModel;
  placesById: ReadonlyMap<string, Place>;
  counted: boolean[];
  directTotal: number;
  onView: () => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const { analysis, stops } = model.evaluation;
  const fits = analysis.withinMappedPreference;
  const st = analysis.stretchesMetres;
  const uncounted = stops.filter((s) => !s.counted);
  const extra = analysis.totalMetres - directTotal;
  const isDirect = stops.length === 0;

  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardKicker}>{isDirect ? "DIRECT" : "WITH A PLACE TO SIT"}</Text>
          <Text accessibilityRole="header" style={styles.cardTitle}>{model.title}</Text>
        </View>
        <StatusBadge fits={fits} size="lg" />
      </View>

      <View style={styles.stats}>
        <StatTile
          label="Longest stretch"
          value={fmtFt(analysis.longestMappedStretchMetres)}
          tone={fits ? "accent" : "caution"}
          a11y={`Longest stretch without a planned rest about ${fmtFt(analysis.longestMappedStretchMetres)}, ${fits ? "within" : "over"} your limit`}
        />
        <StatTile label="Total walk" value={fmtFt(analysis.totalMetres)} a11y={`Total walk about ${fmtFt(analysis.totalMetres)}`} />
      </View>

      <View style={styles.chips}>
        <Chip
          icon={model.countedStops ? "checkmark-circle" : "remove"}
          label={model.countedStops ? `${model.countedStops} rest stop${model.countedStops === 1 ? "" : "s"}` : "No planned rests"}
          tone={model.countedStops ? "accent" : "neutral"}
        />
        {!isDirect ? <Chip icon="walk" label={extra < 1 ? "Same distance" : `+${fmtFt(extra)} vs direct`} /> : null}
        {uncounted.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showWhy }}
            accessibilityLabel={`${uncounted.length} stop not counted as a rest. Why?`}
            onPress={() => setShowWhy((v) => !v)}
            hitSlop={10}
          >
            <Chip icon="help-circle-outline" label={`${uncounted.length} not counted`} tone="caution" />
          </Pressable>
        ) : null}
      </View>
      {showWhy
        ? uncounted.map((s) => (
            <View key={s.occurrenceId} style={styles.whyBox}>
              <Text style={styles.whyText}>
                <Text style={{ fontWeight: "700" }}>{placeLabel(placesById.get(s.placeId))}</Text>: {s.exclusionReasons.map(reasonText).join("; ")}.
              </Text>
            </View>
          ))
        : null}

      {!isDirect ? (
        <View style={styles.ribbonWrap}>
          <Ribbon legMetres={analysis.legMetres} counted={counted} highlightStretch={!fits} />
          <Text style={styles.ribbonText}>
            {st.length > 1 ? `Stretches: ${st.map((m) => fmtFt(m)).join(" → ")}` : `One stretch of ${fmtFt(st[0])}`}
          </Text>
        </View>
      ) : null}

      <View style={styles.tradeoff}>
        <Icon name="chatbubble-ellipses-outline" size={18} color={colors.secondary} />
        <Text style={styles.tradeoffText}>{model.tradeoff}</Text>
      </View>

      <SecondaryButton label="View steps" icon="arrow-forward" accessibilityLabel={`View steps for ${model.title}`} onPress={onView} />
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  center: { flex: 1, padding: space.xl, gap: space.lg, justifyContent: "center", backgroundColor: colors.canvas },
  loading: { alignItems: "center", gap: space.md, paddingVertical: space.xxl },
  body: { fontSize: type.body, color: colors.text, lineHeight: 24 },
  support: { fontSize: type.support, color: colors.secondary, lineHeight: 21 },
  limitRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  limitLabel: { fontSize: type.caption, fontWeight: "700", letterSpacing: 0.5, color: colors.secondary },
  limitValue: { fontSize: type.cardTitle + 2, fontWeight: "800", color: colors.text },
  card: { gap: space.md },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  cardKicker: { fontSize: type.caption, fontWeight: "800", letterSpacing: 1, color: colors.accent },
  cardTitle: { fontSize: type.cardTitle, fontWeight: "800", color: colors.text, marginTop: 2 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  whyBox: { backgroundColor: colors.cautionBg, borderRadius: 12, padding: space.md },
  whyText: { fontSize: type.support, color: colors.cautionText, lineHeight: 21 },
  ribbonWrap: { alignItems: "center", gap: 4, paddingVertical: space.xs },
  ribbonText: { fontSize: type.caption + 1, color: colors.secondary, fontWeight: "600" },
  tradeoff: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  tradeoffText: { flex: 1, fontSize: type.support, color: colors.secondary, lineHeight: 21 },
  footnote: { fontSize: type.caption, color: colors.secondary, textAlign: "center", lineHeight: 18 },
});
