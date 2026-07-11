import { Tabs } from "expo-router";
import { theme } from "../../theme/theme";

/** Bottom tab navigation: Home · AI Health · Records · Me. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: "#12283b" },
        tabBarActiveTintColor: theme.colors.mint,
        tabBarInactiveTintColor: theme.colors.inkMuted
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="ai-health" options={{ title: "AI Health" }} />
      <Tabs.Screen name="records" options={{ title: "Records" }} />
      <Tabs.Screen name="profile" options={{ title: "Me" }} />
    </Tabs>
  );
}
