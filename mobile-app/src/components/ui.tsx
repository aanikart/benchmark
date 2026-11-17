import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { LIMIT_MAX_FT, LIMIT_MIN_FT, LIMIT_STEP_FT, limitHelper } from "../services/units";
import { colors, minTarget, radius, shadow, space, tones, type } from "../theme/tokens";
import type { Tone } from "../theme/tokens";

export type IonName = ComponentProps<typeof Ionicons>["name"];
export type McName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/** Decorative icon: hidden from screen readers (the adjacent text carries the meaning). */
export function Icon({ name, size = 20, color = colors.text }: { name: IonName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} accessibilityElementsHidden importantForAccessibility="no" />;
}

export function IconTile({
  name, size = 44, tone = "soft", palette,
}: { name: McName; size?: number; tone?: "soft" | "solid" | "muted"; palette?: Tone }) {
  const p = palette ? tones[palette] : null;
  const bg = tone === "solid" ? (p ? p.fg : colors.accent) : tone === "muted" ? colors.surfaceTint : (p?.bg ?? colors.accentSoft);
  const fg = tone === "solid" ? colors.onAccent : tone === "muted" ? colors.secondary : (p?.fg ?? colors.accentDark);
  return (
    <View
      style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <MaterialCommunityIcons name={name} size={size * 0.55} color={fg} />
    </View>
  );
}

export function Card({
  children, style, selected,
}: { children: ReactNode; style?: StyleProp<ViewStyle>; selected?: boolean }) {
  return <View style={[styles.card, selected && styles.cardSelected, style]}>{children}</View>;
}
/** Kept for screens that still say Box. */
export const Box = Card;

/** Numbered step header: "1  Start from". */
export function StepHeader({ n, title, detail }: { n?: number; title: string; detail?: string }) {
  return (
    <View style={styles.stepHeader}>
      {n !== undefined ? (
        <View style={styles.stepNum} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.stepNumText}>{n}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={styles.stepTitle}>{title}</Text>
        {detail ? <Text style={styles.stepDetail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text accessibilityRole="header" style={styles.sectionLabel}>{children}</Text>;
}

export function PrimaryButton({
  label, onPress, disabled, hint, busy, icon,
}: { label: string; onPress: () => void; disabled?: boolean; hint?: string; busy?: boolean; icon?: IonName }) {
  const off = !!disabled || !!busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: !!busy }}
      accessibilityHint={hint}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, off && styles.primaryDisabled, pressed && { backgroundColor: colors.accentDark }]}
    >
      <Text style={[styles.primaryText, off && styles.primaryTextDisabled]}>{label}</Text>
      {icon ? <Icon name={icon} size={20} color={off ? colors.secondary : colors.onAccent} /> : null}
    </Pressable>
  );
}

export function SecondaryButton({
  label, onPress, accessibilityLabel, disabled, icon, tone = "accent",
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  icon?: IonName;
  tone?: "accent" | "danger";
}) {
  const fg = disabled ? colors.disabled : tone === "danger" ? "#9A2B1F" : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.secondary, { borderColor: fg }, pressed && { backgroundColor: colors.accentSoft }]}
    >
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.secondaryText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Low-emphasis inline action ("Edit", "Change"). Still a 48pt target. */
export function TextButton({
  label, onPress, accessibilityLabel, icon,
}: { label: string; onPress: () => void; accessibilityLabel?: string; icon?: IonName }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.textBtn, pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.textBtnText}>{label}</Text>
      {icon ? <Icon name={icon} size={16} color={colors.accent} /> : null}
    </Pressable>
  );
}

export function StatusBadge({ fits, size = "md" }: { fits: boolean; size?: "md" | "lg" }) {
  return (
    <View
      style={[styles.badge, fits ? styles.badgeFits : styles.badgeOver, size === "lg" && { paddingVertical: 6, paddingHorizontal: 12 }]}
      accessible
      accessibilityLabel={fits ? "Mapped stretches fit your limit" : "A mapped stretch is over your limit"}
    >
      <Icon name={fits ? "checkmark-circle" : "alert-circle"} size={16} color={fits ? colors.onAccent : colors.text} />
      <Text style={[styles.badgeText, { color: fits ? colors.onAccent : colors.text }]}>{fits ? "Fits" : "Over"}</Text>
    </View>
  );
}

/** Small rounded fact: "1 rest stop", "+40 ft". */
export function Chip({ icon, label, tone = "neutral" }: { icon?: IonName; label: string; tone?: "neutral" | "accent" | "caution" }) {
  const bg = tone === "accent" ? colors.accentSoft : tone === "caution" ? colors.cautionBg : colors.surfaceTint;
  const fg = tone === "accent" ? colors.accentDark : tone === "caution" ? colors.cautionText : colors.secondary;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={15} color={fg} /> : null}
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** Big number with a small label above it. */
export function StatTile({
  label, value, tone = "neutral", a11y,
}: { label: string; value: string; tone?: "neutral" | "caution" | "accent"; a11y?: string }) {
  const bg = tone === "caution" ? colors.cautionBg : tone === "accent" ? colors.accentSoft : colors.surfaceTint;
  const fg = tone === "caution" ? colors.cautionText : tone === "accent" ? colors.accentDark : colors.text;
  return (
    <View style={[styles.stat, { backgroundColor: bg }]} accessible accessibilityLabel={a11y ?? `${label}: ${value}`}>
      <Text style={[styles.statLabel, { color: fg }]}>{label}</Text>
      <Text style={[styles.statValue, { color: fg }]}>{value}</Text>
    </View>
  );
}

/** Amber notice: uncertainty or a recoverable problem. Text plus icon, never color alone. */
export function Notice({ children, action, icon = "alert-circle" }: { children: ReactNode; action?: ReactNode; icon?: IonName }) {
  return (
    <View style={styles.notice} accessibilityRole="alert">
      <Icon name={icon} size={20} color={colors.cautionText} />
      <View style={{ flex: 1, gap: space.sm }}>
        <Text style={styles.noticeText}>{children}</Text>
        {action ? <View style={{ alignItems: "flex-start" }}>{action}</View> : null}
      </View>
    </View>
  );
}

export function ToggleRow({
  label, value, onValueChange, detail,
}: { label: string; value: boolean; onValueChange: (v: boolean) => void; detail?: string }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {detail ? <Text style={styles.toggleDetail}>{detail}</Text> : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onValueChange} trackColor={{ true: colors.accent }} />
    </View>
  );
}

export function LimitStepper({
  valueFt, onChange, showHelper = true,
}: { valueFt: number; onChange: (ft: number) => void; showHelper?: boolean }) {
  const canDec = valueFt > LIMIT_MIN_FT;
  const canInc = valueFt < LIMIT_MAX_FT;
  const btn = (icon: IonName, label: string, enabled: boolean, delta: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={() => onChange(valueFt + delta)}
      style={({ pressed }) => [styles.stepBtn, !enabled && styles.stepBtnOff, pressed && { backgroundColor: colors.accentDark }]}
    >
      <Icon name={icon} size={26} color={enabled ? colors.onAccent : colors.disabled} />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {btn("remove", `Decrease by ${LIMIT_STEP_FT} feet`, canDec, -LIMIT_STEP_FT)}
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={styles.stepValue} accessibilityLiveRegion="polite" accessibilityLabel={`${valueFt} feet. ${limitHelper(valueFt)}`}>
          {valueFt}
          <Text style={styles.stepUnit}> ft</Text>
        </Text>
        {showHelper ? <Text style={styles.stepHelper}>{limitHelper(valueFt)}</Text> : null}
      </View>
      {btn("add", `Increase by ${LIMIT_STEP_FT} feet`, canInc, LIMIT_STEP_FT)}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Attribution({ lines }: { lines: readonly string[] }) {
  return <Text style={styles.attribution}>{lines.join("\n")}</Text>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius, padding: space.lg, borderWidth: 2, borderColor: "transparent", ...shadow },
  cardSelected: { borderColor: colors.accent, backgroundColor: "#F6FBF8" },
  stepHeader: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl, marginBottom: space.md },
  stepNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.sun, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: colors.text, fontWeight: "900", fontSize: 16 },
  stepTitle: { fontSize: type.cardTitle, fontWeight: "700", color: colors.text },
  stepDetail: { fontSize: type.support, color: colors.secondary, marginTop: 1 },
  sectionLabel: {
    fontSize: type.caption, fontWeight: "700", letterSpacing: 1, color: colors.secondary,
    textTransform: "uppercase", marginTop: space.xl, marginBottom: space.sm,
  },
  primary: {
    minHeight: 56, borderRadius: 16, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  primaryDisabled: { backgroundColor: "#E6E3DC" },
  primaryText: { color: colors.onAccent, fontSize: type.body, fontWeight: "700", textAlign: "center" },
  primaryTextDisabled: { color: colors.secondary },
  secondary: {
    minHeight: minTarget, flexDirection: "row", gap: 6, justifyContent: "center", alignItems: "center",
    paddingHorizontal: space.lg, borderWidth: 1.5, borderRadius: 14, backgroundColor: colors.surface,
  },
  secondaryText: { fontSize: type.support, fontWeight: "700" },
  textBtn: { minHeight: minTarget, minWidth: minTarget, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: space.xs },
  textBtnText: { color: colors.accent, fontSize: type.support, fontWeight: "700" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeFits: { backgroundColor: colors.accent },
  badgeOver: { backgroundColor: colors.cautionStrong },
  badgeText: { fontSize: type.support, fontWeight: "800" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: type.caption + 1, fontWeight: "600" },
  stat: { flex: 1, minWidth: 130, borderRadius: 14, paddingHorizontal: space.md, paddingVertical: space.md, gap: 2 },
  statLabel: { fontSize: type.caption, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  statValue: { fontSize: 26, fontWeight: "800" },
  notice: { flexDirection: "row", gap: space.sm, backgroundColor: colors.cautionBg, borderRadius: 14, padding: space.md },
  noticeText: { fontSize: type.support, color: colors.cautionText, lineHeight: 21 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56 },
  toggleLabel: { fontSize: type.body, color: colors.text, fontWeight: "600" },
  toggleDetail: { fontSize: type.support, color: colors.secondary },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  stepBtnOff: { backgroundColor: "#E6E3DC" },
  stepValue: { fontSize: type.hero, fontWeight: "800", color: colors.text },
  stepUnit: { fontSize: type.cardTitle, fontWeight: "600", color: colors.secondary },
  stepHelper: { fontSize: type.support, color: colors.secondary, marginTop: 2, textAlign: "center" },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: space.md },
  attribution: { fontSize: 12, color: colors.secondary, textAlign: "center", marginTop: space.lg, lineHeight: 17 },
});
