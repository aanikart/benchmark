import { useWindowDimensions, View } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";
import { colors } from "../theme/tokens";

/**
 * Rest ribbon overview: start ● — ■ counted rest — ◌ uncounted stop — ● end.
 * Decorative: positions are proportional to leg distance, and every number it implies is
 * stated in text next to it, so it is hidden from accessibility.
 */
export function Ribbon({
  legMetres, counted, height = 32, highlightStretch,
}: {
  legMetres: readonly number[];
  counted: readonly boolean[]; // per intermediate stop
  height?: number;
  highlightStretch?: boolean;
}) {
  const { width: screen } = useWindowDimensions();
  const width = Math.max(160, screen - 96);
  const pad = 12;
  const total = legMetres.reduce((a, b) => a + b, 0) || 1;
  const y = height / 2;
  let acc = 0;
  const xs = legMetres.slice(0, -1).map((m) => {
    acc += m;
    // Bounded so very short legs still leave room for a marker.
    return pad + Math.min(0.92, Math.max(0.08, acc / total)) * (width - 2 * pad);
  });
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height}>
        <Line x1={pad} y1={y} x2={width - pad} y2={y} stroke={highlightStretch ? colors.cautionStrong : colors.accentSoft} strokeWidth={5} strokeLinecap="round" />
        <Circle cx={pad} cy={y} r={7} fill={colors.accentDark} />
        {xs.map((x, i) =>
          counted[i] ? (
            <Rect key={i} x={x - 8} y={y - 8} width={16} height={16} rx={4} fill={colors.accent} />
          ) : (
            <Circle key={i} cx={x} cy={y} r={7} fill={colors.surface} stroke={colors.secondary} strokeWidth={1.5} strokeDasharray="3 2" />
          ),
        )}
        <Circle cx={width - pad} cy={y} r={7} fill={colors.accentDark} />
      </Svg>
    </View>
  );
}
