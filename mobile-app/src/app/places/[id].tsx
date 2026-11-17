import { useLocalSearchParams, useRouter } from "expo-router";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { seatEligibility } from "../../../shared/eligibility";
import { formatSourceDate } from "../../../shared/sourceDates";
import { Box, IconTile, Notice, PrimaryButton, SecondaryButton, SectionLabel } from "../../components/ui";
import { prefsOf, usePlanner } from "../../features/planner/PlannerContext";
import { useCatalog, useComparison } from "../../features/planner/queries";
import { kindIcon, kindLine, kindTone, known, placeLabel, reasonText } from "../../features/planner/viewModel";
import { colors, space, type } from "../../theme/tokens";

export default function PlaceDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = usePlanner();
  const { placesById, placeContext } = useCatalog();
  const cmp = useComparison(state.submitted);
  const place = id ? placesById.get(id) : undefined;

  if (!place) {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>This place isn't in the current download.</Text>
        <SecondaryButton label="Close" onPress={() => router.back()} />
      </View>
    );
  }

  const isSeat = place.role === "seat";
  const eligibility = seatEligibility(place, prefsOf(state));
  const selected = [cmp.data?.direct, cmp.data?.alternative].find((c) => c?.id === state.selectedRouteId);
  const onSelectedRoute = !!selected?.stopPlaceIds.includes(place.id);
  const previewing = state.previewWithout.includes(place.id);
  const access = place.tags.access;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <IconTile name={kindIcon(place)} palette={kindTone(place)} size={56} tone="solid" />
        <Text accessibilityRole="header" style={styles.title}>{placeLabel(place)}</Text>
      </View>
      <Text style={styles.support}>
        {[kindLine(place), placeContext.get(place.id), place.name ? null : "no name in OpenStreetMap"].filter(Boolean).join(" · ")}
      </Text>

      <SectionLabel>What the map says</SectionLabel>
      <Box style={styles.rows}>
        {isSeat ? (
          <>
            <Row label="Seating" value={place.seating === "yes" ? "Yes, according to OpenStreetMap" : known(place.seating)} />
            <Row label="Backrest" value={place.backrest === "unknown" ? "Not mapped" : `${known(place.backrest)}, according to OpenStreetMap`} />
            <Row label="Armrests" value={place.armrest === "unknown" ? "Not mapped" : `${known(place.armrest)}, according to OpenStreetMap`} />
          </>
        ) : (
          <Row label="Seating" value="Not mapped — not counted as a rest" />
        )}
        <Row label="Access restrictions" value={access ? `Mapped as “${access}”` : "Not mapped"} />
        {place.tags.opening_hours ? <Row label="Opening hours" value={place.tags.opening_hours} /> : null}
        <Row label="Location" value={place.coordinateKind === "node" ? "Mapped as a point" : "Approximate (mapped as an area)"} />
        <Row label="Approach from route" value="Unconfirmed" />
        <Row label="Currently usable" value="Unconfirmed" />
      </Box>

      {isSeat && !eligibility.eligible ? (
        <Notice>Not counted as a rest: {eligibility.reasons.map(reasonText).join("; ")}.</Notice>
      ) : null}

      <SectionLabel>Dates</SectionLabel>
      <Box style={styles.rows}>
        <Row label="OpenStreetMap last edited" value={formatSourceDate(place.sourceEditedAt?.slice(0, 7) ?? null)} />
        <Row label="Mapper's check date" value={formatSourceDate(place.mappedCheckDate)} />
        <Row label="Mapper's survey date" value={formatSourceDate(place.mappedSurveyDate)} />
        <Row label="Downloaded" value={formatSourceDate(place.fetchedAt.slice(0, 10))} />
        {place.alsoMappedAs.length ? <Row label="Also mapped as" value={place.alsoMappedAs.join(", ")} /> : null}
      </Box>
      <Text style={styles.support}>
        These dates describe map edits and downloads. Benchmark has not inspected this place.
      </Text>

      {onSelectedRoute ? (
        <View style={{ gap: space.sm }}>
          <PrimaryButton
            label={previewing ? "Restore this stop" : "Preview without this stop"}
            onPress={() => {
              dispatch({ type: "togglePreview", placeId: place.id });
              router.back();
            }}
          />
          <Text style={styles.support}>
            {previewing
              ? "Counts this place as a planned rest again."
              : "Shows the same path without resting here, so you can see the joined distance. It does not find another route."}
          </Text>
        </View>
      ) : null}

      <SecondaryButton
        label="View OpenStreetMap entry"
        icon="map-outline"
        onPress={() => Linking.openURL(`https://www.openstreetmap.org/${place.id}`)}
      />
      <Text style={styles.attribution}>© OpenStreetMap contributors</Text>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  hero: { gap: space.md, alignItems: "flex-start" },
  center: { flex: 1, padding: space.xl, gap: space.lg, justifyContent: "center", backgroundColor: colors.canvas },
  title: { fontSize: type.title, fontWeight: "800", color: colors.text },
  body: { fontSize: type.body, color: colors.text },
  support: { fontSize: type.support, color: colors.secondary },
  rows: { gap: 0, paddingVertical: space.xs },
  row: { gap: 2, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  rowLabel: { fontSize: type.support, color: colors.secondary },
  rowValue: { fontSize: type.body, color: colors.text, fontWeight: "600" },
  attribution: { fontSize: 12, color: colors.secondary, textAlign: "center" },
});
