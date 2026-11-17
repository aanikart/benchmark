import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router/js-tabs";
import { colors } from "../../theme/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.secondary,
        tabBarLabelStyle: { fontSize: 13, fontWeight: "700" },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.hairline, borderTopWidth: 1 },
      }}
    >
      <Tabs.Screen
        name="plan"
        options={{
          title: "Plan",
          tabBarIcon: ({ color, focused, size }) => <Ionicons name={focused ? "compass" : "compass-outline"} color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color, focused, size }) => <Ionicons name={focused ? "bookmark" : "bookmark-outline"} color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
