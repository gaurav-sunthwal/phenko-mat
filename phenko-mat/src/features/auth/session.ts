import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { firebaseConfigured } from "@/config/env";
import { configureApiAuth, request } from "@/lib/api/client";
import { firebaseAuth } from "@/lib/firebase";
import { queryClient } from "@/lib/query/client";
import { disconnectRealtime } from "@/lib/realtime/socket";
import { useChatStore } from "@/features/chat/store";
import { useRecentSearches } from "@/stores/recentSearches";
import { useUi } from "@/stores/ui";
import { useAuth } from "./store";

/*
 * Session lifecycle.
 *
 *   Firebase sign-in ─► POST /api/auth/native (server verifies + creates our users row) ─► signedIn
 *
 * The app is only "signed in" once the server has accepted the identity, so an unverified email
 * account never lands on a half-working feed. On restart the persisted Firebase user is trusted
 * straight away (its row already exists); if the server disagrees, the first 401 signs out.
 */

/** True while a sign-in flow is between "Firebase said yes" and "our server said yes". */
let registering = false;

const needsEmailVerification = (user: User) =>
  user.providerData.some((p) => p.providerId === "password") && !user.emailVerified;

export function initAuth() {
  if (!firebaseConfigured) {
    useAuth.getState().set({ status: "signedOut" });
    return () => undefined;
  }

  const auth = firebaseAuth();
  configureApiAuth({
    getToken: async (force) => (auth.currentUser ? auth.currentUser.getIdToken(force) : null),
    onUnauthorized: () => void signOut({ revoke: false }),
  });

  return onAuthStateChanged(auth, (user) => {
    if (registering) return;
    if (user && !needsEmailVerification(user)) {
      useAuth.getState().set({ status: "signedIn", uid: user.uid });
    } else {
      if (user) void firebaseSignOut(auth);
      useAuth.getState().set({ status: "signedOut", uid: null });
    }
  });
}

/**
 * Runs a Firebase sign-in, then registers the identity with our API. If the server refuses
 * (e.g. EMAIL_NOT_VERIFIED), the error is rethrown and the caller decides whether to keep the
 * Firebase user around (to resend the verification email) or sign out.
 */
export async function completeSignIn(signIn: () => Promise<User>) {
  registering = true;
  try {
    const user = await signIn();
    const token = await user.getIdToken(true);
    await request("POST", "/api/auth/native", { token });
    useAuth.getState().set({ status: "signedIn", uid: user.uid });
  } finally {
    registering = false;
  }
}

/** Clears every trace of the session from memory. */
function clearLocalState() {
  disconnectRealtime();
  queryClient.clear();
  useChatStore.getState().reset();
  useUi.getState().reset();
  useRecentSearches.getState().clear();
}

/**
 * @param revoke also revoke refresh tokens server-side ("sign out everywhere", like the web).
 */
export async function signOut({ revoke = true }: { revoke?: boolean } = {}) {
  if (revoke) await request("DELETE", "/api/auth/session").catch(() => undefined);
  clearLocalState();
  useAuth.getState().set({ status: "signedOut", uid: null });
  if (firebaseConfigured) await firebaseSignOut(firebaseAuth()).catch(() => undefined);
}

/** DELETE /api/me — permanently removes the account; then sign out locally. */
export async function deleteAccount() {
  await request("DELETE", "/api/me");
  await signOut({ revoke: false });
}
