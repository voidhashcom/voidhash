import { Tabs } from "expo-router";

import { useTheme } from "../../lib/theme";

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        sceneStyle: { backgroundColor: theme.background },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.mutedText,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Notes" }} />
      <Tabs.Screen name="upgrade" options={{ title: "Upgrade" }} />
      <Tabs.Screen name="account" options={{ title: "Account" }} />
    </Tabs>
  );
}
