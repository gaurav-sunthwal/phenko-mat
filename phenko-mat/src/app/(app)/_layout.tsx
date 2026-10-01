import { router, Stack, type NativeStackNavigationOptions } from "expo-router";
import { useEffect, useRef } from "react";
import { categoriesQuery } from "@/features/categories/api";
import { connectionsQuery } from "@/features/connections/api";
import { meQuery, useMe } from "@/features/profile/api";
import { identifyUser } from "@/lib/analytics";
import { queryClient } from "@/lib/query/client";
import { connectRealtime, disconnectRealtime } from "@/lib/realtime/socket";
import { onboardingHydrated, useOnboarding } from "@/stores/onboarding";
import { colors, radius } from "@/theme";

export const unstable_settings = { initialRouteName: "(tabs)" };

const sheet = (detent: number): NativeStackNavigationOptions => ({
  presentation: "formSheet",
  sheetAllowedDetents: [detent, 0.95],
  sheetGrabberVisible: true,
  sheetCornerRadius: radius.sheet,
  contentStyle: { backgroundColor: colors.white },
});

/** Signed-in area: keeps the chat socket open and warms the cache for every tab. */
export default function AppLayout() {
  useEffect(() => {
    void queryClient.prefetchQuery(meQuery);
    void queryClient.prefetchQuery(categoriesQuery);
    void queryClient.prefetchQuery(connectionsQuery);
    connectRealtime();
    return disconnectRealtime;
  }, []);
  useWelcomeOnFirstRun();
  const { data: me } = useMe();
  useEffect(() => {
    identifyUser(me?.id ?? null);
  }, [me?.id]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="listing/[id]/index" />
      <Stack.Screen name="listing/[id]/edit" />
      <Stack.Screen name="user/[id]" />
      <Stack.Screen name="new" options={{ animation: "slide_from_bottom", gestureEnabled: false }} />
      {/* A full screen, not a sheet: dragging the map must never pull a sheet down. */}
      <Stack.Screen name="listing-location" options={{ gestureEnabled: false }} />
      <Stack.Screen name="welcome" options={{ presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }} />
      <Stack.Screen name="match" options={{ presentation: "transparentModal", animation: "fade", gestureEnabled: false }} />
      <Stack.Screen name="location" options={sheet(0.72)} />
      <Stack.Screen name="new-category" options={sheet(0.62)} />
      <Stack.Screen name="edit-profile" options={sheet(0.8)} />
      <Stack.Screen name="delete-account" options={sheet(0.5)} />
      <Stack.Screen name="report" options={sheet(0.75)} />
      <Stack.Screen name="give/[id]" options={sheet(0.5)} />
    </Stack>
  );
}

/** New here (no interests yet, welcome not seen on this device): ask what they're looking for first. */
function useWelcomeOnFirstRun() {
  const { data: me } = useMe();
  const shown = useRef(false);
  const userId = me?.id;
  const needsWelcome = me ? me.interests.length === 0 : false;

  useEffect(() => {
    if (!userId || !needsWelcome || shown.current) return;
    let cancelled = false;
    void onboardingHydrated().then(() => {
      if (cancelled || shown.current || useOnboarding.getState().seen[userId]) return;
      shown.current = true;
      router.push("/welcome");
    });
    return () => {
      cancelled = true;
    };
  }, [userId, needsWelcome]);
}
