import { Stack } from "expo-router";
import { colors, type } from "../../../theme/tokens";

export default function SavedLayout() {
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
      <Stack.Screen name="index" options={{ title: "Your saved outings" }} />
      <Stack.Screen name="[id]" options={{ title: "Saved outing" }} />
    </Stack>
  );
}
