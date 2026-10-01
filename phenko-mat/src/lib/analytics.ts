import * as Clarity from "@microsoft/react-native-clarity";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { env } from "@/config/env";
import { reportError } from "@/lib/telemetry";

/*
 * Microsoft Clarity: session replays and heatmaps for the native app.
 *
 * - Needs a native build (dev client / EAS); it's a no-op in Expo Go and on the web build.
 * - We only ever send our internal user id (a UUID), never names or emails.
 * - Screen content masking is configured in the Clarity dashboard (Settings → Masking); keep it on
 *   "Strict" so chat messages and addresses aren't recorded.
 */

const enabled =
  Boolean(env.clarityProjectId) && Platform.OS !== "web" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let started = false;

export function initAnalytics() {
  if (!enabled || started) return;
  started = true;
  try {
    Clarity.initialize(env.clarityProjectId!, {
      // Verbose while developing to debug initialization; silent in release builds.
      logLevel: __DEV__ ? Clarity.LogLevel.Verbose : Clarity.LogLevel.None,
    });
    void Clarity.setCustomTag("environment", __DEV__ ? "development" : "production");
    void Clarity.setCustomTag("appVersion", Constants.expoConfig?.version ?? "unknown");
  } catch (e) {
    started = false;
    reportError(e, { kind: "clarity.init" });
  }
}

/** Links sessions to an account (internal id only), so a reported bug can be matched to its replay. */
export function identifyUser(userId: string | null) {
  if (!started) return;
  if (userId) void Clarity.setCustomUserId(userId).catch(() => undefined);
}

/** Screen names for Clarity's per-screen heatmaps (ids stripped so `/chat/abc` and `/chat/def` group together). */
export function trackScreen(pathname: string) {
  if (!started) return;
  const name = pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id") || "/";
  void Clarity.setCurrentScreenName(name).catch(() => undefined);
}
