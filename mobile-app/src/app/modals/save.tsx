import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LIMITS, SNAPSHOT_SCHEMA_VERSION } from "../../../shared/contracts";
import type { CandidateRoute, OutingSnapshot, ReturnMode } from "../../../shared/contracts";
import { Notice, PrimaryButton, SecondaryButton, SectionLabel } from "../../components/ui";
import { prefsOf, usePlanner } from "../../features/planner/PlannerContext";
import { OWNER, useCatalog, useComparison } from "../../features/planner/queries";
import { placeLabel } from "../../features/planner/viewModel";
import { insertOuting, newUuid, validateName } from "../../services/localStore";
import { ApiError, REGION_ID, fetchReturn, newRequestId } from "../../services/outingApi";
import { colors, minTarget, radius, space, type } from "../../theme/tokens";

const RETURN_CHOICES: { id: ReturnMode; label: string; detail: string }[] = [
  { id: "walk", label: "Walk back", detail: "We'll map a way home past the same benches." },
  { id: "arranged", label: "Getting a ride back", detail: "Just noted for you. Nothing is booked." },
  { id: "undecided", label: "Decide later", detail: "Keep it as a one-way walk for now." },
];

export default function SaveOuting() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state } = usePlanner();
  const { catalog, placesById } = useCatalog();
  const cmp = useComparison(state.submitted);
  const candidate = [cmp.data?.direct, cmp.data?.alternative].find((c) => c?.id === state.selectedRouteId) ?? null;
  const destination = state.submitted ? placesById.get(state.submitted.destinationId) : undefined;

  const [name, setName] = useState(`A walk to ${state.destinationVia?.name ?? placeLabel(destination)}`.slice(0, 80));
  const [note, setNote] = useState("");
  const [returnMode, setReturnMode] = useState<ReturnMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Created before the first attempt and reused on retry, so a retry cannot duplicate the outing.
  const outingId = useRef(newUuid());
  const fetchedReturn = useRef<CandidateRoute | null>(null);

  if (!candidate || !state.submitted || !catalog) {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>There is no selected route to save.</Text>
        <SecondaryButton label="Close" onPress={() => router.back()} />
      </View>
    );
  }
  const submitted = state.submitted;
  const nameOk = validateName(name);

  const save = async () => {
    if (!returnMode || !nameOk || busy) return;
    setBusy(true);
    setError(null);
    try {
      let returnRoute: CandidateRoute | null = null;
      if (returnMode === "walk") {
        try {
          fetchedReturn.current ??= await fetchReturn({
            requestId: newRequestId(),
            origin: { placeId: submitted.originId },
            destination: { placeId: submitted.destinationId },
            stopPlaceIds: candidate.stopPlaceIds,
          });
          returnRoute = fetchedReturn.current;
        } catch (e) {
          setError(
            `Return unavailable: ${e instanceof ApiError ? e.message : "the route service did not respond."} ` +
              "Your outward plan is kept. Retry, or choose another return arrangement.",
          );
          return;
        }
      }
      const ids = [submitted.originId, submitted.destinationId, ...candidate.stopPlaceIds];
      const snapshot: OutingSnapshot = {
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        regionId: REGION_ID,
        originPlaceId: submitted.originId,
        destinationPlaceId: submitted.destinationId,
        prefs: prefsOf(state),
        outward: candidate,
        returnMode,
        returnRoute,
        places: [...new Set(ids)].map((id) => placesById.get(id)!).filter(Boolean),
        catalogFetchedAt: catalog.fetchedAt,
        catalogOrigin: catalog.origin,
        attribution: [candidate.route.attribution, "Places © OpenStreetMap contributors"],
        savedAt: new Date().toISOString(),
      };
      try {
        await insertOuting({ id: outingId.current, name, note, snapshot });
      } catch {
        setError("Couldn't save on this phone. Your plan is still open; free some storage or retry.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["saved", OWNER] });
      router.dismissAll();
      router.navigate("/saved");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={64}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionLabel>Call it</SectionLabel>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={80}
          accessibilityLabel="Name of this walk"
          style={styles.input}
        />
        {!nameOk ? <Text style={styles.error} accessibilityRole="alert">Enter a name for this outing.</Text> : null}

        <SectionLabel>A note to yourself (optional)</SectionLabel>
        <TextInput
          value={note}
          onChangeText={setNote}
          maxLength={LIMITS.maxNoteLength}
          multiline
          accessibilityLabel="Private note, optional"
          style={[styles.input, styles.note]}
        />
        <Text style={styles.support}>{note.length}/{LIMITS.maxNoteLength} · only on this phone</Text>

        <SectionLabel>And the way home?</SectionLabel>
        <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
          {RETURN_CHOICES.map((c) => {
            const on = c.id === returnMode;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${c.label}. ${c.detail}`}
                onPress={() => { setReturnMode(c.id); setError(null); }}
                style={[styles.choice, on && styles.choiceOn]}
              >
                <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.choiceLabel}>{c.label}</Text>
                  <Text style={styles.support}>{c.detail}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {!returnMode ? <Text style={styles.support}>Pick how you'll get home to keep this walk.</Text> : null}

        {error ? <Notice>{error}</Notice> : null}

        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <PrimaryButton
            label={busy ? "Keeping…" : error && returnMode === "walk" ? "Try again" : "Keep this walk"}
            busy={busy}
            disabled={!returnMode || !nameOk}
            onPress={save}
          />
          <SecondaryButton label="Cancel" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  center: { flex: 1, padding: space.xl, gap: space.lg, justifyContent: "center", backgroundColor: colors.canvas },
  body: { fontSize: type.body, color: colors.text },
  support: { fontSize: type.support, color: colors.secondary, marginTop: space.xs },
  error: { fontSize: type.support, color: colors.cautionText, marginTop: space.xs },
  input: {
    minHeight: minTarget, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius,
    backgroundColor: colors.surface, paddingHorizontal: space.lg, paddingVertical: space.md,
    fontSize: type.body, color: colors.text,
  },
  note: { minHeight: 96, textAlignVertical: "top" },
  choice: {
    flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 64, backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius, padding: space.md, margin: 1.5,
  },
  choiceOn: { borderWidth: 3, borderColor: colors.accent, backgroundColor: colors.accentSoft, margin: 0 },
  choiceLabel: { fontSize: type.body, fontWeight: "600", color: colors.text },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.secondary, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
});
