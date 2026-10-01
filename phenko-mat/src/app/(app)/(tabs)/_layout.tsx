import { Tabs } from "expo-router/js-tabs";
import { AppHeader } from "@/features/shell/AppHeader";
import { TabBar } from "@/features/shell/TabBar";
import { colors } from "@/theme";

export const unstable_settings = { initialRouteName: "feed" };

/** Header + bottom bar shared by Feed, Categories, Profile and Chats (web: (tabs)/layout.tsx). */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={() => <TabBar />}
      screenOptions={{ header: () => <AppHeader />, sceneStyle: { backgroundColor: colors.paper } }}
    >
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="categories" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="chats" />
    </Tabs>
  );
}
