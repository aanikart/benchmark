import { Stack, useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ribbon } from "../../../components/Ribbon";
import { RouteMap } from "../../../components/RouteMap";
import { RouteTimeline } from "../../../components/RouteTimeline";
import { Attribution, Box, Card, Notice, PrimaryButton, SecondaryButton, StatTile, StatusBadge } from "../../../components/ui";
import { prefsOf, usePlanner } from "../../../features/planner/PlannerContext";
import { useCatalog, useComparison } from "../../../features/planner/queries";
import { destinationLabel, placeLabel, routeCardModel } from "../../../features/planner/viewModel";
import { fmtFt, walkMinutes } from "../../../services/units";
import { colors, minTarget, space, type } from "../../../theme/tokens";

export default function RouteSteps() {
  const router = useRouter();
  const { state } = usePlanner();
  const { placesById } = useCatalog();
  const cmp = useComparison(state.submitted);
  const [speaking, setSpeaking] = useState(false);
  const [showDirections, setShowDirections] = useState(false);

  const candidate =
    cmp.data && state.selectedRouteId
      ? [cmp.data.direct, cmp.data.alternative].find((c) => c?.id === state.selectedRouteId) ?? null
      : null;
  const preview = useMemo(() => new Set(state.previewWithout), [state.previewWithout]);
  const prefs = prefsOf(state);
  const model = useMemo(
    () => (candidate && cmp.data ? routeCardModel(candidate, cmp.data.direct, placesById, prefs, preview) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidate, cmp.data, placesById, state.limitFt, state.requireBackrest, state.allowPicnicTables, preview],
  );

  useEffect(() => () => { Speech.stop(); }, []);

  if (!candidate || !model || !state.submitted) {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>This route is no longer available.</Text>
        <SecondaryButton label="Build this plan again" onPress={() => router.replace("/plan")} />
      </View>
    );
  }

  const origin = placesById.get(state.submitted.originId);
  const destination = placesById.get(state.submitted.destinationId);
  const { analysis, stops } = model.evaluation;
  const countedByPlace = new Map(stops.map((s) => [s.placeId, s.counted]));
  const previewing = stops.filter((s) => s.exclusionReasons.includes("PREVIEW_WITHOUT_STOP"));

  const spoken = [
    `${model.title}. Start at ${placeLabel(origin)}.`,
    ...candidate.route.legMetres.flatMap((m, i) => {
      const stop = stops[i];
      const walk = `Walk about ${fmtFt(m).replace(" ft", " feet")}, around ${walkMinutes(m)} minute${walkMinutes(m) === 1 ? "" : "s"}.`;
      if (!stop) return [walk];
      const name = placeLabel(placesById.get(stop.placeId));
      return [walk, stop.counted ? `Rest at ${name}.` : `Pass ${name}, not counted as a rest.`];
    }),
    `Arrive at ${destinationLabel(destination, state.destinationVia)}.`,
    `The longest stretch between pauses is about ${fmtFt(analysis.longestMappedStretchMetres).replace(" ft", " feet")}. Seating and approach are unconfirmed.`,
  ].join(" ");

  const toggleSpeech = async () => {
    if (speaking) {
      await Speech.stop();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      Speech.speak(spoken, { onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
    }
  };

  const openStop = (id: string) => router.push({ pathname: "/places/[id]", params: { id } });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: model.title,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={speaking ? "Stop reading aloud" : "Read route aloud"}
              hitSlop={8}
              onPress={toggleSpeech}
              style={styles.readAloud}
            >
              <Text style={styles.readAloudGlyph}>{speaking ? "⏹" : "🔊"}</Text>
            </Pressable>
          ),
        }}
      />

      <Card style={{ gap: space.sm, padding: space.sm }}>
        <RouteMap candidate={candidate} placesById={placesById} countedByPlace={countedByPlace} onStopPress={openStop} />
        <View style={{ alignItems: "center" }}>
          <Ribbon legMetres={analysis.legMetres} counted={stops.map((s) => s.counted)} highlightStretch={!analysis.withinMappedPreference} />
        </View>
      </Card>

      <Card style={{ gap: space.md }}>
        <View style={styles.summaryHead}>
          <Text style={styles.limitText}>Pause every <Text style={styles.bold}>{state.limitFt} ft</Text></Text>
          <StatusBadge fits={analysis.withinMappedPreference} size="lg" />
        </View>
        <View style={styles.stats}>
          <StatTile
            label="Longest stretch"
            value={fmtFt(analysis.longestMappedStretchMetres)}
            tone={analysis.withinMappedPreference ? "accent" : "caution"}
          />
          <StatTile label="Whole walk" value={fmtFt(analysis.totalMetres)} />
        </View>
        <Text style={styles.support}>Measured along mapped paths. Benches come from map data, so give them a glance as you go.</Text>
      </Card>

      {previewing.length > 0 ? (
        <Notice>
          Same path, but skipping the pause at {previewing.map((s) => placeLabel(placesById.get(s.placeId))).join(" or ")}.
          This is a "what if", not a new route. Open the stop to bring the pause back.
        </Notice>
      ) : null}

      <RouteTimeline
        candidate={candidate}
        evaluation={model.evaluation}
        placesById={placesById}
        startLabel={placeLabel(origin)}
        endLabel={destinationLabel(destination, state.destinationVia)}
        onStopPress={openStop}
      />

      {candidate.route.steps.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <SecondaryButton
            label={showDirections ? "Hide turn-by-turn" : "Show turn-by-turn"}
            onPress={() => setShowDirections((v) => !v)}
          />
          {showDirections
            ? candidate.route.steps.map((s, i) => (
                <Text key={i} style={styles.direction}>
                  {i + 1}. {s.instruction}{s.distanceM > 0 ? ` (≈ ${fmtFt(s.distanceM)})` : ""}
                </Text>
              ))
            : null}
        </View>
      ) : null}

      <PrimaryButton
        label="Keep this walk"
        icon="bookmark-outline"
        disabled={previewing.length > 0}
        hint={previewing.length > 0 ? "Bring the skipped pause back before keeping this walk" : undefined}
        onPress={() => router.push("/modals/save")}
      />
      {previewing.length > 0 ? <Text style={styles.support}>Bring the skipped pause back to keep this walk.</Text> : null}

      <Attribution lines={[candidate.route.attribution]} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  center: { flex: 1, padding: space.xl, gap: space.lg, justifyContent: "center", backgroundColor: colors.canvas },
  body: { flexShrink: 1, fontSize: type.body, color: colors.text },
  bold: { fontWeight: "700" },
  support: { fontSize: type.support, color: colors.secondary },
  readAloud: { minWidth: minTarget, minHeight: 40, alignItems: "center", justifyContent: "center" },
  readAloudGlyph: { fontSize: 22 },
  limitText: { fontSize: type.body, color: colors.text },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  summaryHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  direction: { fontSize: type.support, color: colors.text },
});
