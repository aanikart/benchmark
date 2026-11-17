import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { usePlanner } from "../../../features/planner/PlannerContext";
import { useCatalog } from "../../../features/planner/queries";
import { Icon, IconTile } from "../../../components/ui";
import { kindIcon, kindLine, kindTone, placeLabel } from "../../../features/planner/viewModel";
import { colors, minTarget, radius, shadow, space, type } from "../../../theme/tokens";

/** Named starting places from the downloaded catalog. Works without location permission. */
export default function StartPicker() {
  const router = useRouter();
  const { state, dispatch } = usePlanner();
  const { catalog, placeContext } = useCatalog();
  const [text, setText] = useState("");

  const items = useMemo(() => {
    const q = text.trim().toLowerCase();
    return (catalog?.places ?? [])
      .filter((p) => p.role === "landmark" && p.routingPoint !== null && p.name)
      .filter(
        (p) =>
          !q ||
          p.name!.toLowerCase().includes(q) ||
          kindLine(p).toLowerCase().includes(q) ||
          (placeContext.get(p.id) ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => a.name!.localeCompare(b.name!) || a.id.localeCompare(b.id));
  }, [catalog, placeContext, text]);

  return (
    <View style={styles.screen}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Search starting places"
        placeholderTextColor={colors.secondary}
        accessibilityLabel="Search starting places by name"
        style={styles.search}
        clearButtonMode="while-editing"
      />
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: space.xxl }}
        ListEmptyComponent={<Text style={styles.empty}>No places match that search.</Text>}
        renderItem={({ item }) => {
          const selected = item.id === state.originId;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={[placeLabel(item), kindLine(item), placeContext.get(item.id)].filter(Boolean).join(", ")}
              onPress={() => {
                dispatch({ type: "setOrigin", id: item.id });
                router.back();
              }}
              style={({ pressed }) => [styles.row, selected && styles.rowOn, pressed && { opacity: 0.8 }]}
            >
              <IconTile name={kindIcon(item)} palette={kindTone(item)} size={40} tone={selected ? "solid" : "soft"} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{placeLabel(item)}</Text>
                <Text style={styles.kind}>{kindLine(item)}</Text>
                {placeContext.get(item.id) ? <Text style={styles.context}>{placeContext.get(item.id)}</Text> : null}
              </View>
              {selected ? <Icon name="checkmark-circle" size={24} color={colors.accent} /> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: space.lg, paddingTop: space.md },
  search: {
    minHeight: minTarget + 4, borderWidth: 1.5, borderColor: colors.hairline, borderRadius: 14,
    backgroundColor: colors.surface, paddingHorizontal: space.lg, fontSize: type.body, color: colors.text,
    marginBottom: space.md,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 68, backgroundColor: colors.surface,
    borderWidth: 2, borderColor: "transparent", borderRadius: radius, paddingHorizontal: space.md,
    paddingVertical: space.sm, marginBottom: space.sm + 2, ...shadow,
  },
  rowOn: { borderColor: colors.accent, backgroundColor: "#F6FBF8" },
  name: { fontSize: type.body, fontWeight: "600", color: colors.text },
  kind: { fontSize: type.support, color: colors.secondary },
  context: { fontSize: type.support, color: colors.text },
  empty: { fontSize: type.support, color: colors.secondary, textAlign: "center", marginTop: space.xl },
});
