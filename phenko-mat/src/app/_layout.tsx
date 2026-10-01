import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { useFonts } from "expo-font";
import { Stack, usePathname, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppProviders } from "@/components/AppProviders";
import { AppSplash } from "@/components/AppSplash";
import { Text } from "@/components/ui";
import { initAuth } from "@/features/auth/session";
import { useAuth } from "@/features/auth/store";
import { wireQueryToNative } from "@/lib/query/client";
import { initAnalytics, trackScreen } from "@/lib/analytics";
import { installGlobalErrorHandler, reportError } from "@/lib/telemetry";
import { colors } from "@/theme";

installGlobalErrorHandler();
initAnalytics();
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 250 });

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const status = useAuth((s) => s.status);
  const pathname = usePathname();

  useEffect(() => {
    trackScreen(pathname);
  }, [pathname]);

  useEffect(() => {
    wireQueryToNative();
    return initAuth();
  }, []);

  // The native splash stays up until fonts are in; then the branded splash takes over (and hides it) and
  // stays until we know whether someone is signed in, so there's no flash of the login screen.
  const fontsReady = fontsLoaded || Boolean(fontError);
  const [splashDone, setSplashDone] = useState(false);
  const hideSplash = useCallback(() => setSplashDone(true), []);

  const signedIn = status === "signedIn";

  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ animation: "fade" }} />
        </Stack.Protected>
      </Stack>
      {fontsReady && !splashDone ? <AppSplash ready={status !== "initializing"} onDone={hideSplash} /> : null}
    </AppProviders>
  );
}

/** A screen crashed while rendering (expo-router error boundary): report it and offer a retry. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportError(error, { kind: "render" });
  }, [error]);
  return (
    <View style={styles.crash}>
      <Text size={44}>🙈</Text>
      <Text weight="extrabold" size="2xl" align="center">
        Something went wrong
      </Text>
      <Text color={colors.inkSoft} align="center">
        We&apos;ve been told about it. Try again, and if it keeps happening, come back in a bit.
      </Text>
      <Pressable onPress={() => void retry()} style={styles.retry} accessibilityRole="button">
        <Text weight="bold" color={colors.white}>
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  crash: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32, backgroundColor: colors.paper },
  retry: { marginTop: 12, borderRadius: 999, backgroundColor: colors.ink, paddingHorizontal: 24, paddingVertical: 12 },
});
