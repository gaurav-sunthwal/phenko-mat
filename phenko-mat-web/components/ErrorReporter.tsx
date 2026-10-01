"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client/reportError";

/** Reports errors that happen outside React rendering (event handlers, timers, failed promises). */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportClientError(e.error ?? e.message, { kind: "window.error" });
    const onRejection = (e: PromiseRejectionEvent) => reportClientError(e.reason, { kind: "unhandledrejection" });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
