import { useWindowDimensions, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "../theme/tokens";

/**
 * Decorative backdrop for the Plan banner: topographic contour lines and a dashed
 * walking trail that pauses at a bench marker. Hidden from screen readers.
 */
export function TrailBanner({ height }: { height: number }) {
  const { width } = useWindowDimensions();
  const w = Math.max(width, 320);
  const h = height;
  // Concentric, slightly irregular contour rings centred off the right edge.
  const cx = w * 0.88;
  const cy = h * 0.32;
  const rings = [40, 78, 118, 160, 204, 250, 298].map((r, i) => {
    const wob = 6 + i * 2;
    return `M ${cx - r} ${cy} C ${cx - r} ${cy - r * 0.62 - wob}, ${cx + r * 0.7} ${cy - r * 0.8}, ${cx + r} ${cy - wob}
            S ${cx + r * 0.4} ${cy + r * 0.85 + wob}, ${cx - r * 0.3} ${cy + r * 0.7} S ${cx - r} ${cy + wob}, ${cx - r} ${cy} Z`;
  });
  // A winding trail from bottom-left that ends at a bench marker.
  // Kept in the bottom band so it never runs through the banner's text.
  const bx = w * 0.84;
  const trail = `M -10 ${h - 14} C ${w * 0.25} ${h - 32}, ${w * 0.38} ${h - 4}, ${w * 0.56} ${h - 18} S ${w * 0.74} ${h - 34}, ${bx - 12} ${h - 28}`;
  return (
    <View
      style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Svg width={w} height={h}>
        {rings.map((d, i) => (
          <Path key={i} d={d} fill="none" stroke={colors.contour} strokeWidth={1.2} opacity={0.9 - i * 0.08} />
        ))}
        <Path d={trail} fill="none" stroke={colors.sun} strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" opacity={0.85} />
        <Circle cx={w * 0.56} cy={h - 18} r={4} fill={colors.sun} opacity={0.85} />
        <Rect x={bx - 10} y={h - 38} width={20} height={20} rx={5} fill={colors.sun} />
        <Path d={`M ${bx - 6} ${h - 26} h 12 M ${bx - 4} ${h - 26} v 4 M ${bx + 4} ${h - 26} v 4 M ${bx - 6} ${h - 31} h 12`} stroke={colors.accentDark} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
