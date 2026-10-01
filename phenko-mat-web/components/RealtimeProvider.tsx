"use client";

import { useEffect } from "react";
import { preloadAppData } from "@/lib/client/hooks";
import { connectRealtime, disconnectRealtime } from "@/lib/client/realtime";

/** Keeps the chat WebSocket open while any signed-in screen is mounted, and warms the data cache. */
export function RealtimeProvider() {
  useEffect(() => {
    preloadAppData();
    connectRealtime();
    return disconnectRealtime;
  }, []);
  return null;
}
