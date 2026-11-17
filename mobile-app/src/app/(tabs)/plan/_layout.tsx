import { Stack } from "expo-router";
import { colors, type } from "../../../theme/tokens";

export default function PlanLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerShadowVisible: false,
        headerTintColor: colors.accent,
        headerTitleStyle: { fontSize: type.cardTitle, color: colors.text },
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Plan", headerShown: false }} />
      <Stack.Screen name="start" options={{ title: "Starting point" }} />
      <Stack.Screen name="compare" options={{ title: "Routes" }} />
      <Stack.Screen name="steps" options={{ title: "Route steps" }} />
    </Stack>
  );
}
