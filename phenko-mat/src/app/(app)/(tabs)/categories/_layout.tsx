import { Stack } from "expo-router";
import { colors } from "@/theme";

/** Categories tab has its own stack so a category deck keeps the tab bar (as on web). */
export default function CategoriesLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />;
}
