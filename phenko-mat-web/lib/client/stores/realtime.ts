"use client";

import { create } from "zustand";

export type RealtimeStatus = "idle" | "connecting" | "open" | "reconnecting";

interface RealtimeState {
  status: RealtimeStatus;
  /** Our user id, as confirmed by the gateway. */
  userId: string | null;
  set: (patch: Partial<Pick<RealtimeState, "status" | "userId">>) => void;
}

export const useRealtimeStore = create<RealtimeState>()((set) => ({
  status: "idle",
  userId: null,
  set: (patch) => set(patch),
}));
