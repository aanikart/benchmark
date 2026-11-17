import NetInfo from "@react-native-community/netinfo";
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { PlannerProvider } from "../features/planner/PlannerContext";
import { colors, type } from "../theme/tokens";

export default function RootLayout() {
  const [client] = useState(() => new QueryClient());

  // Connect Query's focus and online managers once; remove listeners on cleanup.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => focusManager.setFocused(s === "active"));
    const unsubscribeNet = NetInfo.addEventListener((s) => onlineManager.setOnline(s.isConnected !== false));
    return () => {
      sub.remove();
      unsubscribeNet();
    };
  }, []);

  return (
    <QueryClientProvider client={client}>
      <PlannerProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontSize: type.cardTitle, color: colors.text },
            contentStyle: { backgroundColor: colors.canvas },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="places/[id]" options={{ headerShown: true, presentation: "modal", title: "Place details" }} />
          <Stack.Screen name="modals/save" options={{ headerShown: true, presentation: "modal", title: "Save this outing" }} />
        </Stack>
      </PlannerProvider>
    </QueryClientProvider>
  );
}
