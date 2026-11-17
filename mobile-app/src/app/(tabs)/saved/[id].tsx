import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LIMITS } from "../../../../shared/contracts";
import { RouteTimeline } from "../../../components/RouteTimeline";
import { Attribution, Box, Notice, PrimaryButton, SecondaryButton, SectionLabel, StatusBadge } from "../../../components/ui";
import { ageLabel, outingView } from "../../../features/outings/outingView";
import { usePlanner } from "../../../features/planner/PlannerContext";
import { OWNER } from "../../../features/planner/queries";
import { placeLabel } from "../../../features/planner/viewModel";
import { deleteOuting, getOuting, updateOutingText, validateName } from "../../../services/localStore";
import { newRequestId } from "../../../services/outingApi";
import { fmtFt, mToFt } from "../../../services/units";
import { colors, minTarget, radius, space, type } from "../../../theme/tokens";

export default function SavedOutingDetail() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { dispatch } = usePlanner();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ["saved", OWNER, id], queryFn: () => getOuting(id!), enabled: !!id });
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) {
      setName(q.data.name);
      setNote(q.data.note);
    }
  }, [q.data]);

  if (q.isPending) return <View style={styles.center}><Text style={styles.body}>Loading…</Text></View>;
  const row = q.data;
  if (!row) {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>This outing is no longer saved on this phone.</Text>
        <SecondaryButton label="Back to saved outings" onPress={() => router.back()} />
      </View>
    );
  }
  if (!row.snapshot) {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>This outing was saved by a different app version. Update the app to open it.</Text>
      </View>
    );
  }

  const s = row.snapshot;
  const v = outingView(s);
  const limitFt = Math.round(mToFt(s.prefs.maxStretchM));
  const origin = v.placesById.get(s.originPlaceId);
  const destination = v.placesById.get(s.destinationPlaceId);
  const dirty = name !== row.name || note !== row.note;

  const saveText = async () => {
    try {
      await updateOutingText(row.id, name, note);
      await queryClient.invalidateQueries({ queryKey: ["saved", OWNER] });
      setStatus("Changes saved on this phone.");
    } catch {
      setStatus("Couldn't save changes on this phone.");
    }
  };

  const confirmDelete = () =>
    Alert.alert("Delete this outing?", "It will be removed from this phone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteOuting(row.id);
          await queryClient.invalidateQueries({ queryKey: ["saved", OWNER] });
          router.back();
        },
      },
    ]);

  // A refresh builds a new comparison; it never silently alters this saved plan.
  const refresh = () => {
    dispatch({ type: "setLimit", ft: limitFt });
    dispatch({ type: "setRequireBackrest", value: s.prefs.requireBackrest });
    dispatch({ type: "setAllowPicnicTables", value: s.prefs.allowPicnicTables });
    dispatch({ type: "setOrigin", id: s.originPlaceId });
    dispatch({ type: "setDestination", id: s.destinationPlaceId });
    dispatch({ type: "submit", requestId: newRequestId() });
    router.navigate("/plan/compare");
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: row.name }} />

      <Notice action={<SecondaryButton label="Refresh for today" onPress={refresh} />}>
        Saved {ageLabel(row.savedAt)}, using places downloaded {ageLabel(s.catalogFetchedAt)}. This is the plan as it
        was saved; seats and paths may have changed.
      </Notice>

      <Box style={{ gap: space.sm }}>
        <View style={styles.head}>
          <Text style={styles.cardTitle}>OUTWARD</Text>
          <StatusBadge fits={v.outward.analysis.withinMappedPreference} />
        </View>
        <Text style={styles.body}>
          ≈ {fmtFt(v.outward.analysis.totalMetres)} · longest gap ≈ {fmtFt(v.outward.analysis.longestMappedStretchMetres)} · limit {limitFt} ft
        </Text>
      </Box>
      <RouteTimeline
        candidate={s.outward}
        evaluation={v.outward}
        placesById={v.placesById}
        startLabel={placeLabel(origin)}
        endLabel={placeLabel(destination)}
      />

      <SectionLabel>Getting back</SectionLabel>
      {s.returnRoute && v.back && v.completeStretches ? (
        <>
          <Box style={{ gap: space.sm }}>
            <View style={styles.head}>
              <Text style={styles.cardTitle}>RETURN</Text>
              <StatusBadge fits={v.back.analysis.withinMappedPreference} />
            </View>
            <Text style={styles.body}>
              ≈ {fmtFt(v.back.analysis.totalMetres)} · longest gap ≈ {fmtFt(v.back.analysis.longestMappedStretchMetres)}
            </Text>
          </Box>
          <RouteTimeline
            candidate={s.returnRoute}
            evaluation={v.back}
            placesById={v.placesById}
            startLabel={placeLabel(destination)}
            endLabel={placeLabel(origin)}
          />
          <Box style={{ gap: space.sm }}>
            <View style={styles.head}>
              <Text style={styles.cardTitle}>COMPLETE OUTING</Text>
              <StatusBadge fits={Math.max(...v.completeStretches) <= s.prefs.maxStretchM} />
            </View>
            <Text style={styles.body}>
              ≈ {fmtFt(v.outward.analysis.totalMetres + v.back.analysis.totalMetres)} there and back · longest gap ≈{" "}
              {fmtFt(Math.max(...v.completeStretches))}
            </Text>
            <Text style={styles.support}>
              Stretches between rests: {v.completeStretches.map((m) => `≈ ${fmtFt(m)}`).join(" · ")}. No rest is
              counted at the destination, so the walk in and the walk out are joined.
            </Text>
          </Box>
        </>
      ) : (
        <Box>
          <Text style={styles.body}>{v.returnLabel}</Text>
          <Text style={styles.support}>
            {s.returnMode === "arranged"
              ? "No walking-back distance is calculated. Nothing has been booked by this app."
              : "This is an outward-only draft, not a complete round trip."}
          </Text>
        </Box>
      )}

      <SectionLabel>Name and private note</SectionLabel>
      <TextInput value={name} onChangeText={(t) => { setName(t); setStatus(null); }} maxLength={80} accessibilityLabel="Outing name" style={styles.input} />
      <TextInput
        value={note}
        onChangeText={(t) => { setNote(t); setStatus(null); }}
        maxLength={LIMITS.maxNoteLength}
        multiline
        placeholder="Private note (optional)"
        placeholderTextColor={colors.secondary}
        accessibilityLabel="Private note, optional"
        style={[styles.input, { minHeight: 96, textAlignVertical: "top" }]}
      />
      {dirty ? <PrimaryButton label="Save changes" disabled={!validateName(name)} onPress={saveText} /> : null}
      {status ? <Text style={styles.support} accessibilityLiveRegion="polite">{status}</Text> : null}

      <Text style={styles.support}>Saved on this phone. Cloud backup isn't connected yet.</Text>
      <SecondaryButton label="Delete this outing" onPress={confirmDelete} />
      <Attribution lines={s.attribution} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  center: { flex: 1, padding: space.xl, gap: space.lg, justifyContent: "center", backgroundColor: colors.canvas },
  body: { fontSize: type.body, color: colors.text },
  support: { fontSize: type.support, color: colors.secondary },
  head: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: space.sm },
  cardTitle: { fontSize: type.cardTitle, fontWeight: "800", letterSpacing: 0.5, color: colors.text },
  input: {
    minHeight: minTarget, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius,
    backgroundColor: colors.surface, paddingHorizontal: space.lg, paddingVertical: space.md,
    fontSize: type.body, color: colors.text,
  },
});
