import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import type { ScrollViewInstance } from "react-native";
import type { PlaceGroup } from "../../../../shared/areas";
import type { Place } from "../../../../shared/contracts";
import { seatEligibility } from "../../../../shared/eligibility";
import { distanceM } from "../../../../shared/geo";
import { formatSourceDate } from "../../../../shared/sourceDates";
import {
  Attribution, Card, Divider, Icon, IconTile, LimitStepper, Notice, PrimaryButton, SecondaryButton, StepHeader, TextButton, ToggleRow,
} from "../../../components/ui";
import { prefsOf, usePlanner } from "../../../features/planner/PlannerContext";
import { useCatalog } from "../../../features/planner/queries";
import { TrailBanner } from "../../../components/TrailBanner";
import { kindIcon, kindLine, kindTone, placeLabel } from "../../../features/planner/viewModel";
import { newRequestId } from "../../../services/outingApi";
import { fmtFt } from "../../../services/units";
import { colors, minTarget, radius, shadow, space, type } from "../../../theme/tokens";
import type { Tone } from "../../../theme/tokens";

type Filter = "all" | "art" | "everyday" | "seats";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Anywhere" },
  { id: "art", label: "Art & views" },
  { id: "everyday", label: "Coffee & books" },
  { id: "seats", label: "Benches & tables" },
];
const PAGE = 8;

type Entry =
  | { type: "place"; place: Place; nearbyM: number | null }
  | { type: "group"; group: PlaceGroup; nearbyM: number | null };
const entryId = (e: Entry) => (e.type === "group" ? e.group.id : e.place.id);
const entryName = (e: Entry) => (e.type === "group" ? e.group.name : placeLabel(e.place));

export default function PlanHome() {
  const router = useRouter();
  const { state, dispatch } = usePlanner();
  const { catalog, placesById, placeContext, groups, serviceUnreachable, isPending, refetch, isRefetching } = useCatalog();
  const [filter, setFilter] = useState<Filter>("all");
  const [text, setText] = useState("");
  const [shown, setShown] = useState(PAGE);
  const insets = useSafeAreaInsets();
  const [heroH, setHeroH] = useState(0);
  // Keep the search box visible while typing: scroll it up and hide the pinned bar.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const searchY = useRef(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  // Light status-bar text over the green banner; dark again when another screen is on top.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("dark");
    }, []),
  );

  const origin = state.originId ? placesById.get(state.originId) : undefined;
  const destination = state.destinationId ? placesById.get(state.destinationId) : undefined;
  const prefs = prefsOf(state);

  // Local filtering only: no API call per keystroke.
  const choices = useMemo((): Entry[] => {
    if (!catalog) return [];
    const q = text.trim().toLowerCase();
    const from = origin?.displayCoordinate ?? null;
    const grouped = new Map<string, PlaceGroup>();
    for (const g of groups) for (const id of g.memberIds) grouped.set(id, g);
    const groupEntries: Entry[] =
      filter === "all" || filter === "art"
        ? groups
            .filter((g) => !q || g.name.toLowerCase().includes(q))
            .map((g) => ({
              type: "group",
              group: g,
              nearbyM: from ? distanceM(from, placesById.get(g.defaultMemberId)!.displayCoordinate) : null,
            }))
        : [];
    const placeEntries: Entry[] = catalog.places
      .filter((p) => (p.routingPoint !== null || p.role === "landmark") && p.id !== state.originId)
      .filter((p) => !grouped.has(p.id) || (q.length > 0 && placeLabel(p).toLowerCase().includes(q)))
      .filter((p) => {
        if (filter === "seats") return p.role === "seat" && seatEligibility(p, { ...prefs, allowPicnicTables: true }).eligible;
        if (p.role !== "landmark") return false;
        if (filter === "art") return p.kind === "artwork" || p.kind === "viewpoint";
        if (filter === "everyday") return p.kind === "cafe" || p.kind === "library" || p.kind === "community_centre";
        return true;
      })
      .filter(
        (p) =>
          !q ||
          placeLabel(p).toLowerCase().includes(q) ||
          kindLine(p).toLowerCase().includes(q) ||
          (placeContext.get(p.id) ?? "").toLowerCase().includes(q),
      )
      .map((p): Entry => ({ type: "place", place: p, nearbyM: from ? distanceM(from, p.displayCoordinate) : null }));
    return [...groupEntries, ...placeEntries].sort((a, b) =>
      a.nearbyM !== null && b.nearbyM !== null
        ? a.nearbyM - b.nearbyM
        : entryName(a).localeCompare(entryName(b)) || entryId(a).localeCompare(entryId(b)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, groups, placesById, placeContext, text, filter, origin, state.originId, state.requireBackrest]);

  const selectedEntryId = state.destinationVia?.id ?? state.destinationId;

  const visible = useMemo(() => {
    const list = choices.slice(0, shown);
    if (selectedEntryId && !list.some((c) => entryId(c) === selectedEntryId)) {
      const sel = choices.find((c) => entryId(c) === selectedEntryId);
      if (sel) list.unshift(sel);
    }
    return list;
  }, [choices, shown, selectedEntryId]);

  // Arrival choices for a garden (its artworks) or an outlined building (named points within 200 m).
  const arrival = useMemo(() => {
    const via = state.destinationVia;
    if (!via || !catalog) return null;
    if (via.kind === "group") {
      const g = groups.find((x) => x.id === via.id);
      return g ? g.memberIds.map((id) => placesById.get(id)!).filter(Boolean) : [];
    }
    const area = placesById.get(via.id);
    if (!area) return [];
    return catalog.places
      .filter((p) => p.role === "landmark" && p.routingPoint && p.name && p.id !== state.originId)
      .map((p) => ({ p, d: distanceM(area.displayCoordinate, p.displayCoordinate) }))
      .filter((x) => x.d <= 200)
      .sort((a, b) => a.d - b.d || a.p.id.localeCompare(b.p.id))
      .slice(0, 4)
      .map((x) => x.p);
  }, [state.destinationVia, state.originId, catalog, groups, placesById]);

  const missing = !origin
    ? "Pick where you're setting off from"
    : state.destinationVia && !destination
      ? `Pick where to arrive at ${state.destinationVia.name}`
      : !destination
        ? "Pick where you're heading"
        : null;

  const destName = state.destinationVia?.name ?? (destination ? placeLabel(destination) : null);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={[styles.hero, { paddingTop: insets.top + space.lg }]} onLayout={(e) => setHeroH(e.nativeEvent.layout.height)}>
          {heroH > 0 ? <TrailBanner height={heroH} /> : null}
          <View style={styles.brandRow}>
            <View style={styles.brandMark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <MaterialCommunityIcons name="bench" size={26} color={colors.text} />
            </View>
            <Text style={styles.brand} accessibilityRole="header">Benchmark</Text>
          </View>
          <Text style={styles.heroTitle}>Where shall we{"\n"}walk today?</Text>
          <Text style={styles.heroSub}>Every route, with a bench in mind.</Text>
          <View style={styles.areaRow}>
            <Icon name="location" size={15} color={colors.text} />
            <Text style={styles.areaText}>Stanford campus</Text>
          </View>
        </View>
        <View style={styles.body}>

        {isPending ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.support}>Loading places…</Text>
          </View>
        ) : null}
        {catalog && serviceUnreachable ? (
          <Notice
            icon="cloud-offline-outline"
            action={<SecondaryButton label={isRefetching ? "Retrying…" : "Retry"} icon="refresh" onPress={() => refetch()} disabled={isRefetching} />}
          >
            Couldn't reach the route service. Showing places downloaded {formatSourceDate(catalog.fetchedAt.slice(0, 10))}. New routes need a
            connection.
          </Notice>
        ) : null}

        {/* 1 · Start */}
        <StepHeader n={1} title="Set off from" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={origin ? `Starting point: ${placeLabel(origin)}. Change` : "Choose a starting point"}
          onPress={() => router.push("/plan/start")}
          style={({ pressed }) => [styles.rowCard, pressed && styles.pressed]}
        >
          <IconTile name={origin ? kindIcon(origin) : "map-marker"} palette={origin ? kindTone(origin) : "seat"} tone={origin ? "solid" : "soft"} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={2}>{origin ? placeLabel(origin) : "Your trailhead"}</Text>
            <Text style={styles.rowSub} numberOfLines={2}>
              {origin ? placeContext.get(origin.id) ?? kindLine(origin) : "A café, library, sculpture or hall"}
            </Text>
          </View>
          <Text style={styles.rowAction}>{origin ? "Change" : "Choose"}</Text>
          <Icon name="chevron-forward" size={18} color={colors.accent} />
        </Pressable>

        {/* 2 · Destination */}
        <StepHeader n={2} title="Head towards" detail={destName ? `Heading to ${destName}` : "Somewhere worth the walk"} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="radiogroup">
          {FILTERS.map((f) => {
            const on = f.id === filter;
            return (
              <Pressable
                key={f.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => { setFilter(f.id); setShown(PAGE); }}
                style={[styles.filter, on && styles.filterOn]}
              >
                <Text style={[styles.filterText, on && styles.filterTextOn]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.search} onLayout={(e) => { searchY.current = e.nativeEvent.layout.y; }}>
          <Icon name="search" size={18} color={colors.secondary} />
          <TextInput
            value={text}
            onChangeText={(t) => { setText(t); setShown(PAGE); }}
            placeholder="Search a place, building or artist"
            placeholderTextColor={colors.secondary}
            accessibilityLabel="Search places by name, building or artist"
            style={styles.searchInput}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            onFocus={() => {
              // The search box lives inside the padded body; add the banner height to get its scroll offset.
              setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, heroH + searchY.current - space.md), animated: true }), 50);
            }}
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </View>

        <View style={styles.list} accessibilityRole="radiogroup">
          {visible.map((entry) => {
            const id = entryId(entry);
            const selected = selectedEntryId === id;
            return (
              <Fragment key={id}>
                {entry.type === "group" ? (
                  <PlaceRow
                    icon="flower-tulip"
                    palette="garden"
                    title={entry.group.name}
                    sub={`Sculpture garden · ${entry.group.memberIds.length} works to wander past`}
                    nearbyM={entry.nearbyM}
                    selected={selected}
                    onPress={() =>
                      dispatch({
                        type: "setDestination",
                        id: entry.group.defaultMemberId,
                        via: { id: entry.group.id, name: entry.group.name, kind: "group" },
                      })
                    }
                  />
                ) : (
                  <PlaceRow
                    icon={kindIcon(entry.place)}
                    palette={kindTone(entry.place)}
                    title={placeLabel(entry.place)}
                    sub={kindLine(entry.place)}
                    where={placeContext.get(entry.place.id)}
                    note={entry.place.routingPoint === null ? "Pick a doorstep to arrive at" : undefined}
                    nearbyM={entry.nearbyM}
                    selected={selected}
                    onPress={() =>
                      entry.place.routingPoint
                        ? dispatch({ type: "setDestination", id: entry.place.id })
                        : dispatch({ type: "chooseArea", via: { id: entry.place.id, name: placeLabel(entry.place), kind: "area" } })
                    }
                    onDetails={() => router.push({ pathname: "/places/[id]", params: { id: entry.place.id } })}
                  />
                )}
                {selected && state.destinationVia && arrival ? (
                  <ArrivalChooser
                    viaName={state.destinationVia.name}
                    isGroup={state.destinationVia.kind === "group"}
                    options={arrival}
                    selectedId={state.destinationId}
                    context={placeContext}
                    onChoose={(pid) => dispatch({ type: "setDestination", id: pid, via: state.destinationVia })}
                  />
                ) : null}
              </Fragment>
            );
          })}
        </View>
        {catalog && choices.length === 0 ? (
          <Text style={[styles.support, styles.center]}>
            {text ? "Nothing on the map by that name." : "Nothing of this kind on the map around here."}
          </Text>
        ) : null}
        {choices.length > shown ? (
          <View style={styles.more}>
            <SecondaryButton label={`Show ${Math.min(PAGE, choices.length - shown)} more`} icon="add" onPress={() => setShown((n) => n + PAGE)} />
          </View>
        ) : null}

        {/* 3 · Rest preference */}
        <StepHeader n={3} title="Pause every…" detail="The longest stretch you'd like between rests" />
        <Card>
          <LimitStepper valueFt={state.limitFt} onChange={(ft) => dispatch({ type: "setLimit", ft })} />
          <Divider />
          <ToggleRow
            label="Only benches with a backrest"
            detail="Skip seats where a backrest isn't mapped"
            value={state.requireBackrest}
            onValueChange={(value) => dispatch({ type: "setRequireBackrest", value })}
          />
          <ToggleRow
            label="Picnic tables count too"
            detail="Treat mapped picnic tables as places to pause"
            value={state.allowPicnicTables}
            onValueChange={(value) => dispatch({ type: "setAllowPicnicTables", value })}
          />
        </Card>

        <Attribution lines={["Places © OpenStreetMap contributors"]} />
        </View>
      </ScrollView>

      {/* Pinned action (hidden while typing so it never covers the search box) */}
      {keyboardOpen ? null : (
      <View style={styles.footer}>
        {missing ? (
          <View style={styles.missingRow}>
            <Icon name="information-circle-outline" size={16} color={colors.secondary} />
            <Text style={styles.missing}>{missing}</Text>
          </View>
        ) : null}
        <PrimaryButton
          label="Map my walk"
          icon="footsteps-outline"
          disabled={missing !== null}
          hint={missing ?? undefined}
          onPress={() => {
            dispatch({ type: "submit", requestId: newRequestId() });
            router.push("/plan/compare");
          }}
        />
      </View>
      )}
    </KeyboardAvoidingView>
  );
}

function PlaceRow({
  icon, palette, title, sub, where, note, nearbyM, selected, onPress, onDetails,
}: {
  icon: Parameters<typeof IconTile>[0]["name"];
  palette: Tone;
  title: string;
  sub: string;
  where?: string;
  note?: string;
  nearbyM: number | null;
  selected: boolean;
  onPress: () => void;
  onDetails?: () => void;
}) {
  const a11y = [title, sub, where, note, nearbyM !== null ? `about ${fmtFt(nearbyM)} away in a straight line` : null]
    .filter(Boolean)
    .join(", ");
  return (
    <View style={[styles.placeRow, selected && styles.placeRowOn]}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={a11y}
        onPress={onPress}
        style={({ pressed }) => [styles.placeMain, pressed && styles.pressed]}
      >
        <IconTile name={icon} palette={palette} tone={selected ? "solid" : "soft"} />
        <View style={styles.rowText}>
          <Text style={styles.placeTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>
          {where ? (
            <View style={styles.whereRow}>
              <Icon name="location" size={13} color={colors.accent} />
              <Text style={styles.where} numberOfLines={2}>{where}</Text>
            </View>
          ) : null}
          {note ? <Text style={styles.note}>{note}</Text> : null}
        </View>
        <View style={styles.placeRight}>
          {selected ? <Icon name="checkmark-circle" size={26} color={colors.accent} /> : null}
          {nearbyM !== null ? <Text style={styles.dist}>{fmtFt(nearbyM)}</Text> : null}
        </View>
      </Pressable>
      {onDetails ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Details for ${title}`}
          onPress={onDetails}
          hitSlop={4}
          style={({ pressed }) => [styles.infoBtn, pressed && styles.pressed]}
        >
          <Icon name="information-circle-outline" size={24} color={colors.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ArrivalChooser({
  viaName, isGroup, options, selectedId, context, onChoose,
}: {
  viaName: string;
  isGroup: boolean;
  options: readonly Place[];
  selectedId: string | null;
  context: ReadonlyMap<string, string>;
  onChoose: (id: string) => void;
}) {
  const [open, setOpen] = useState(!selectedId);
  const selected = options.find((o) => o.id === selectedId);
  return (
    <View style={styles.arrival}>
      <View style={styles.arrivalHead}>
        <Icon name="flag" size={16} color={colors.accentDark} />
        <Text style={styles.arrivalTitle} accessibilityRole="header">
          {selected && !open ? `Arriving by ${placeLabel(selected)}` : `Where in ${viaName}?`}
        </Text>
        {selected && !open ? (
          <TextButton label="Change" accessibilityLabel={`Change where you arrive at ${viaName}`} onPress={() => setOpen(true)} />
        ) : null}
      </View>
      {!isGroup && (open || !selected) ? (
        <Text style={styles.arrivalHint}>This one's mapped as a whole building. Pick a nearby spot to walk to; we don't know where its doors are.</Text>
      ) : null}
      {open || !selected ? (
        options.length === 0 ? (
          <Text style={styles.arrivalHint}>Nothing mapped close enough to walk up to. Try another destination.</Text>
        ) : (
          <View accessibilityRole="radiogroup" style={styles.arrivalOptions}>
            {options.map((o) => {
              const on = o.id === selectedId;
              return (
                <Pressable
                  key={o.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={[placeLabel(o), isGroup ? null : context.get(o.id)].filter(Boolean).join(", ")}
                  onPress={() => { onChoose(o.id); setOpen(false); }}
                  style={[styles.arrivalOption, on && styles.arrivalOptionOn]}
                >
                  <Text style={[styles.arrivalOptionText, on && { color: colors.onAccent }]} numberOfLines={2}>{placeLabel(o)}</Text>
                </Pressable>
              );
            })}
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: space.xxl },
  body: { paddingHorizontal: space.lg },
  hero: {
    backgroundColor: colors.accentDark, paddingHorizontal: space.xl, paddingBottom: space.xxl + 8,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden", gap: space.sm,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm },
  brandMark: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.sun, alignItems: "center", justifyContent: "center" },
  brand: { fontSize: 22, fontWeight: "800", color: colors.onAccent, letterSpacing: 2, textTransform: "uppercase" },
  heroTitle: { fontSize: 32, fontWeight: "800", color: colors.onAccent, letterSpacing: -0.5, lineHeight: 38 },
  heroSub: { fontSize: type.body, color: "#D8E3D3", lineHeight: 23, maxWidth: 300, fontStyle: "italic" },
  pressed: { opacity: 0.75 },
  areaRow: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: colors.sun, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: space.sm },
  areaText: { fontSize: type.support, fontWeight: "800", color: colors.text },
  loading: { flexDirection: "row", gap: space.sm, alignItems: "center", paddingTop: space.lg },
  support: { fontSize: type.support, color: colors.secondary },
  center: { textAlign: "center", marginTop: space.md },

  rowCard: {
    flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.surface,
    borderRadius: radius, padding: space.lg, minHeight: 76, ...shadow,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: type.body + 1, fontWeight: "700", color: colors.text },
  rowSub: { fontSize: type.support, color: colors.secondary },
  rowAction: { fontSize: type.support, fontWeight: "700", color: colors.accent },

  filters: { gap: space.sm, paddingBottom: space.md },
  filter: {
    minHeight: 40, justifyContent: "center", paddingHorizontal: space.lg, borderRadius: 999,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.hairline,
  },
  filterOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { fontSize: type.support, fontWeight: "600", color: colors.text },
  filterTextOn: { color: colors.onAccent },
  search: {
    flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: minTarget + 4, borderRadius: 14,
    backgroundColor: colors.surface, paddingHorizontal: space.md, marginBottom: space.md, borderWidth: 1.5, borderColor: colors.hairline,
  },
  searchInput: { flex: 1, fontSize: type.body, color: colors.text, paddingVertical: space.sm },

  list: { gap: space.sm + 2 },
  placeRow: {
    flexDirection: "row", alignItems: "stretch", backgroundColor: colors.surface, borderRadius: radius,
    borderWidth: 2, borderColor: "transparent", ...shadow,
  },
  placeRowOn: { borderColor: colors.accent, backgroundColor: "#F3F7F0" },
  placeMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, paddingLeft: space.md, minHeight: 72 },
  placeTitle: { fontSize: type.body, fontWeight: "700", color: colors.text },
  whereRow: { flexDirection: "row", alignItems: "flex-start", gap: 3, marginTop: 2 },
  where: { flex: 1, fontSize: type.support - 1, color: colors.text },
  note: { fontSize: type.caption, color: colors.cautionText, fontWeight: "600", marginTop: 2 },
  placeRight: { alignItems: "flex-end", gap: 4, minWidth: 54 },
  dist: { fontSize: type.caption, fontWeight: "700", color: colors.secondary },
  infoBtn: { width: minTarget, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderLeftColor: colors.hairline },

  arrival: { backgroundColor: colors.accentSoft, borderRadius: 14, padding: space.md, gap: space.sm, marginTop: -2 },
  arrivalHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  arrivalTitle: { flex: 1, fontSize: type.support, fontWeight: "700", color: colors.accentDark },
  arrivalHint: { fontSize: type.caption + 1, color: colors.accentDark, lineHeight: 19 },
  arrivalOptions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  arrivalOption: {
    minHeight: 40, justifyContent: "center", paddingHorizontal: space.md, borderRadius: 999,
    backgroundColor: colors.surface, maxWidth: "100%",
  },
  arrivalOptionOn: { backgroundColor: colors.accent },
  arrivalOptionText: { fontSize: type.support, fontWeight: "600", color: colors.text },

  more: { alignItems: "center", marginTop: space.lg },

  footer: {
    backgroundColor: colors.surface, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md,
    borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: space.sm, ...shadow,
  },
  missingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  missing: { fontSize: type.support, color: colors.secondary },
});
