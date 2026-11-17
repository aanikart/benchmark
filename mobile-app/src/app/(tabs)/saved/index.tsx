import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ribbon } from "../../../components/Ribbon";
import { Card, Chip, IconTile, Notice, SecondaryButton, StatusBadge } from "../../../components/ui";
import { ageLabel, outingView } from "../../../features/outings/outingView";
import { OWNER } from "../../../features/planner/queries";
import { listOutings } from "../../../services/localStore";
import type { SavedOutingRow } from "../../../services/localStore";
import { fmtFt, mToFt } from "../../../services/units";
import { colors, space, type } from "../../../theme/tokens";

export default function SavedOutings() {
  const router = useRouter();
  const q = useQuery({ queryKey: ["saved", OWNER], queryFn: listOutings });

  if (q.isError) {
    return (
      <View style={styles.empty}>
        <Notice action={<SecondaryButton label="Retry" onPress={() => q.refetch()} />}>
          Couldn't read saved outings on this phone.
        </Notice>
      </View>
    );
  }
  if (q.data && q.data.length === 0) {
    return (
      <View style={styles.empty}>
        <IconTile name="bench" size={72} />
        <Text style={styles.emptyTitle}>No saved outings yet</Text>
        <Text style={styles.support}>Plan an outing and choose “Save this outing” to keep it here.</Text>
        <SecondaryButton label="Plan an outing" icon="compass-outline" onPress={() => router.navigate("/plan")} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {(q.data ?? []).map((row) => (
        <OutingCard key={row.id} row={row} onPress={() => router.push({ pathname: "/saved/[id]", params: { id: row.id } })} />
      ))}
      <Text style={styles.note}>Saved on this phone. Cloud backup isn't connected yet.</Text>
    </ScrollView>
  );
}

function OutingCard({ row, onPress }: { row: SavedOutingRow; onPress: () => void }) {
  if (!row.snapshot) {
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>{row.name}</Text>
        <Text style={styles.support}>This outing was saved by a different app version and needs an update to open.</Text>
      </Card>
    );
  }
  const v = outingView(row.snapshot);
  const a = v.outward.analysis;
  const longest = v.completeStretches ? Math.max(...v.completeStretches) : a.longestMappedStretchMetres;
  const fits = longest <= row.snapshot.prefs.maxStretchM;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.name}. ${v.returnLabel}. About ${fmtFt(a.totalMetres)} outward. Longest mapped stretch about ${fmtFt(longest)}, ${fits ? "within" : "over"} your limit. Saved ${ageLabel(row.savedAt)}. Open`}
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      <Card style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.title}>{row.name}</Text>
          <StatusBadge fits={fits} />
        </View>
        <View style={{ alignItems: "center" }}>
          <Ribbon legMetres={a.legMetres} counted={v.outward.stops.map((s) => s.counted)} height={28} />
        </View>
        <View style={styles.facts}>
          <Fact label="Longest stretch" value={fmtFt(longest)} />
          <Fact label="Outward" value={fmtFt(a.totalMetres)} />
          <Fact label="Your limit" value={`${Math.round(mToFt(row.snapshot.prefs.maxStretchM))} ft`} />
        </View>
        <View style={styles.chips}>
          <Chip
            icon={row.snapshot.returnMode === "walk" ? "return-down-back" : row.snapshot.returnMode === "arranged" ? "checkmark-circle" : "help-circle-outline"}
            label={v.returnLabel}
            tone={row.snapshot.returnMode === "undecided" ? "caution" : "neutral"}
          />
          <Chip icon="time-outline" label={`Saved ${ageLabel(row.savedAt)}`} />
        </View>
      </Card>
    </Pressable>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { flexDirection: "row", flexWrap: "wrap", gap: space.lg },
  fact: { gap: 1 },
  factLabel: { fontSize: type.caption, fontWeight: "700", color: colors.secondary, textTransform: "uppercase", letterSpacing: 0.4 },
  factValue: { fontSize: type.body + 1, fontWeight: "800", color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.lg, gap: space.lg },
  empty: { flex: 1, backgroundColor: colors.canvas, padding: space.xl, gap: space.lg, justifyContent: "center", alignItems: "center" },
  emptyTitle: { fontSize: type.cardTitle, fontWeight: "800", color: colors.text },
  support: { fontSize: type.support, color: colors.secondary },
  card: { gap: space.md },
  head: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: space.sm },
  title: { fontSize: type.cardTitle, fontWeight: "800", color: colors.text, flex: 1 },
  note: { fontSize: 13, color: colors.secondary, textAlign: "center" },
});
