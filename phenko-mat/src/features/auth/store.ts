import { create } from "zustand";

export type AuthStatus = "initializing" | "signedOut" | "signedIn";

interface AuthState {
  status: AuthStatus;
  uid: string | null;
  set: (patch: Partial<Pick<AuthState, "status" | "uid">>) => void;
}

/** Drives the route guards in src/app/_layout.tsx. */
export const useAuth = create<AuthState>()((set) => ({
  status: "initializing",
  uid: null,
  set: (patch) => set(patch),
}));
