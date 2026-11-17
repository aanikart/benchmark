import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import type { CandidateRoute, Place } from "../../shared/contracts";
import type { CandidateEvaluation } from "../../shared/routeMetrics";
import { placeLabel, reasonText, seatSummary } from "../features/planner/viewModel";
import { fmtFt, walkMinutes } from "../services/units";
import { colors, minTarget, radius, shadow, space, type } from "../theme/tokens";
import { Icon } from "./ui";

/** Vertical timeline in chronological order: START → walk → REST / NOT COUNTED → … → END. */
export function RouteTimeline({
  candidate, evaluation, placesById, startLabel, endLabel, onStopPress,
}: {
  candidate: CandidateRoute;
  evaluation: CandidateEvaluation;
  placesById: ReadonlyMap<string, Place>;
  startLabel: string;
  endLabel: string;
  onStopPress?: (placeId: string) => void;
}) {
  const legs = candidate.route.legMetres;
  return (
    <View>
      <Node marker="start" kicker="Start" title={startLabel} />
      {legs.map((m, i) => {
        const stop = evaluation.stops[i];
        const place = stop ? placesById.get(stop.placeId) : undefined;
        return (
          <View key={i}>
            <Segment>
              <View style={styles.walk} accessible accessibilityLabel={`Walk about ${fmtFt(m)}, around ${walkMinutes(m)} minutes`}>
                <Icon name="walk" size={16} color={colors.secondary} />
                <Text style={styles.walkText}>
                  {fmtFt(m)} <Text style={styles.walkMin}>· ~{walkMinutes(m)} min</Text>
                </Text>
              </View>
            </Segment>
            {stop ? (
              <Node
                marker={stop.counted ? "rest" : "unknown"}
                kicker={stop.counted ? "Rest stop" : "Not counted as a rest"}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    `${stop.counted ? "Rest stop" : "Not counted as a rest"}: ${placeLabel(place)}. ` +
                    (stop.counted ? (place ? seatSummary(place) : "") : reasonText(stop.exclusionReasons[0])) +
                    ". Approach unconfirmed. Open details"
                  }
                  disabled={!onStopPress}
                  onPress={() => onStopPress?.(stop.placeId)}
                  style={({ pressed }) => [styles.stopCard, !stop.counted && styles.stopCardMuted, pressed && { opacity: 0.8 }]}
                >
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[styles.stopName, !stop.counted && { color: colors.text }]}>{placeLabel(place)}</Text>
                    <Text style={styles.stopDetail}>
                      {stop.counted ? (place ? seatSummary(place) : "") : reasonText(stop.exclusionReasons[0])}
                    </Text>
                    <Text style={styles.stopFoot}>Last few steps unconfirmed · {fmtFt(stop.snapOffsetMetres)} from the path</Text>
                  </View>
                  {onStopPress ? <Icon name="chevron-forward" size={20} color={colors.accent} /> : null}
                </Pressable>
              </Node>
            ) : null}
          </View>
        );
      })}
      <Node marker="end" kicker="Arrive" title={endLabel} last />
    </View>
  );
}

function Marker({ kind }: { kind: "start" | "end" | "rest" | "unknown" }) {
  if (kind === "rest") {
    return (
      <View style={[styles.marker, styles.markerRest]}>
        <MaterialCommunityIcons name="bench" size={18} color={colors.onAccent} />
      </View>
    );
  }
  if (kind === "unknown") {
    return (
      <View style={[styles.marker, styles.markerUnknown]}>
        <Text style={styles.markerQ}>?</Text>
      </View>
    );
  }
  return (
    <View style={[styles.marker, styles.markerEnd]}>
      <MaterialCommunityIcons name={kind === "start" ? "map-marker" : "flag-checkered"} size={16} color={colors.onAccent} />
    </View>
  );
}

function Node({
  marker, kicker, title, children, last,
}: { marker: "start" | "end" | "rest" | "unknown"; kicker: string; title?: string; children?: ReactNode; last?: boolean }) {
  return (
    <View style={styles.nodeRow}>
      <View style={styles.rail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Marker kind={marker} />
        {!last ? <View style={[styles.railLine, { flex: 1 }]} /> : null}
      </View>
      <View style={styles.nodeBody}>
        <Text accessibilityRole="header" style={[styles.kicker, marker === "unknown" && { color: colors.secondary }]}>
          {kicker.toUpperCase()}
        </Text>
        {title ? <Text style={styles.nodeTitle}>{title}</Text> : null}
        {children}
      </View>
    </View>
  );
}

function Segment({ children }: { children: ReactNode }) {
  return (
    <View style={styles.segmentRow}>
      <View style={styles.rail}>
        <View style={[styles.railLine, { flex: 1 }]} />
      </View>
      <View style={styles.segmentBody}>{children}</View>
    </View>
  );
}

const RAIL = 36;
const styles = StyleSheet.create({
  nodeRow: { flexDirection: "row" },
  rail: { width: RAIL, alignItems: "center" },
  railLine: { width: 3, backgroundColor: colors.accentSoft, borderRadius: 2 },
  marker: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  markerEnd: { backgroundColor: colors.accentDark },
  markerRest: { backgroundColor: colors.accent, borderRadius: 10 },
  markerUnknown: { backgroundColor: colors.surface, borderWidth: 2, borderStyle: "dashed", borderColor: colors.disabled },
  markerQ: { fontSize: 15, fontWeight: "800", color: colors.secondary },
  nodeBody: { flex: 1, marginLeft: space.md, paddingBottom: space.sm, gap: 4, paddingTop: 6 },
  kicker: { fontSize: type.caption, fontWeight: "800", letterSpacing: 1, color: colors.accent },
  nodeTitle: { fontSize: type.body + 1, fontWeight: "700", color: colors.text },
  segmentRow: { flexDirection: "row", minHeight: 48 },
  segmentBody: { flex: 1, marginLeft: space.md, justifyContent: "center", paddingVertical: space.sm },
  walk: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  walkText: { fontSize: type.support, fontWeight: "700", color: colors.text },
  walkMin: { fontWeight: "500", color: colors.secondary },
  stopCard: {
    flexDirection: "row", alignItems: "center", minHeight: minTarget + 16, backgroundColor: colors.surface,
    borderRadius: radius - 4, paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm, marginTop: 2, ...shadow,
  },
  stopCardMuted: { backgroundColor: colors.surfaceTint, shadowOpacity: 0, elevation: 0, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.disabled },
  stopName: { fontSize: type.body, fontWeight: "700", color: colors.accentDark },
  stopDetail: { fontSize: type.support, color: colors.text },
  stopFoot: { fontSize: type.caption, color: colors.secondary },
});
