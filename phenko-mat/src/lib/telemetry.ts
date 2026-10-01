import Constants from "expo-constants";
import { Platform } from "react-native";
import { env } from "@/config/env";
import { currentToken } from "@/lib/api/client";

/** Max reports per app session, so a crash loop can't spam the endpoint. */
const MAX_REPORTS = 10;
let sent = 0;
const seen = new Set<string>();

/** Sends a crash/error report to the admin Errors page (web: lib/client/reportError.ts). Never throws. */
export function reportError(error: unknown, extra?: { screen?: string; kind?: string; fatal?: boolean }) {
  try {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000) || "(no message)";
    const key = `${extra?.kind ?? ""}|${message}`;
    if (sent >= MAX_REPORTS || seen.has(key)) return;
    seen.add(key);
    sent++;
    const body = JSON.stringify({
      source: "mobile",
      message,
      stack: error instanceof Error ? error.stack?.slice(0, 8000) : undefined,
      route: extra?.screen?.slice(0, 200),
      meta: {
        kind: extra?.kind ?? "error",
        fatal: Boolean(extra?.fatal),
        platform: Platform.OS,
        os: String(Platform.Version),
        appVersion: Constants.expoConfig?.version ?? "unknown",
        dev: __DEV__,
      },
    });
    void currentToken().then((token) =>
      fetch(`${env.apiUrl}/api/telemetry/errors`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
        body,
      }).catch(() => undefined),
    );
  } catch {
    // Reporting must never cause another error.
  }
}

let installed = false;

/** Reports uncaught JS errors, then hands them to React Native's default handler (red box / crash). */
export function installGlobalErrorHandler() {
  if (installed) return;
  installed = true;
  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, { kind: "global", fatal: isFatal });
    previous(error, isFatal);
  });
}
