"use client";

import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ApiRequestError, api } from "@/lib/client/api";
import { clientAuth, firebaseConfigured } from "@/lib/client/firebase";
import { safeNext } from "@/lib/format";

type Mode = "signin" | "signup";

const FIREBASE_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/invalid-email": "That email doesn't look right.",
  "auth/email-already-in-use": "An account with this email already exists. Try signing in.",
  "auth/weak-password": "Use at least 8 characters for your password.",
  "auth/too-many-requests": "Too many attempts. Please wait a bit and try again.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/account-exists-with-different-credential":
    "You already have an account with this email using a different sign-in method.",
  "auth/network-request-failed": "Network error. Check your connection.",
};

function describe(e: unknown) {
  if (e instanceof FirebaseError) return FIREBASE_MESSAGES[e.code] ?? "Sign-in failed. Please try again.";
  if (e instanceof ApiRequestError) return e.message;
  return "Something went wrong. Please try again.";
}

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [unverified, setUnverified] = useState<User | null>(null);

  /** Hand the Firebase ID token to our server, which verifies it and sets an httpOnly cookie. */
  async function startSession(user: User) {
    const idToken = await user.getIdToken(true);
    try {
      await api("POST", "/api/auth/session", { idToken });
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === "EMAIL_NOT_VERIFIED") {
        setUnverified(user);
        throw e;
      }
      await signOut(await clientAuth());
      throw e;
    }
    // The server session is now the source of truth; drop the client-side Firebase session.
    await signOut(await clientAuth());
    router.replace(next);
    router.refresh();
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  }

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const auth = await clientAuth();
      if (mode === "signup") {
        if (password.length < 8) throw new FirebaseError("auth/weak-password", "");
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim().slice(0, 60) });
        await sendEmailVerification(cred.user);
        await signOut(auth);
        setMode("signin");
        setPassword("");
        setNotice(`We sent a verification link to ${email.trim()}. Verify, then sign in.`);
        return;
      }
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await startSession(cred.user);
    });
  };

  const socialSignIn = (provider: "google" | "apple") =>
    run(async () => {
      const auth = await clientAuth();
      let p: GoogleAuthProvider | OAuthProvider;
      if (provider === "google") {
        p = new GoogleAuthProvider();
        p.setCustomParameters({ prompt: "select_account" });
      } else {
        p = new OAuthProvider("apple.com");
        p.addScope("email");
        p.addScope("name");
      }
      const cred = await signInWithPopup(auth, p);
      await startSession(cred.user);
    });

  const resendVerification = () =>
    run(async () => {
      if (!unverified) return;
      await sendEmailVerification(unverified);
      await signOut(await clientAuth());
      setUnverified(null);
      setNotice("Verification email sent again. Check your inbox (and spam).");
    });

  const resetPassword = () =>
    run(async () => {
      if (!email.trim()) throw new FirebaseError("auth/invalid-email", "");
      await sendPasswordResetEmail(await clientAuth(), email.trim());
      // Same message whether or not the account exists (no account enumeration).
      setNotice("If an account exists for that email, a reset link is on its way.");
    });

  if (!firebaseConfigured) {
    return (
      <p className="rounded-2xl bg-white p-4 text-sm">
        Sign-in isn&apos;t configured yet. Add the <code>NEXT_PUBLIC_FIREBASE_*</code> values to <code>.env.local</code>{" "}
        and restart the dev server.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <button
          onClick={() => socialSignIn("apple")}
          disabled={busy}
          className="flex w-full items-center justify-center gap-3 rounded-full bg-ink px-5 py-3.5 font-bold text-white transition hover:bg-black disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16.37 12.9c-.02-2.1 1.72-3.12 1.8-3.17-.98-1.44-2.51-1.64-3.05-1.66-1.3-.13-2.54.77-3.2.77-.66 0-1.68-.75-2.76-.73-1.42.02-2.73.83-3.46 2.1-1.48 2.56-.38 6.35 1.06 8.43.7 1.02 1.54 2.16 2.63 2.12 1.06-.04 1.46-.68 2.73-.68 1.28 0 1.64.68 2.76.66 1.14-.02 1.86-1.04 2.55-2.06.81-1.18 1.14-2.32 1.16-2.38-.03-.01-2.21-.85-2.22-3.4ZM14.3 6.73c.58-.7.97-1.68.86-2.65-.84.03-1.85.56-2.45 1.26-.54.62-1.01 1.62-.88 2.57.93.07 1.88-.47 2.47-1.18Z" />
          </svg>
          Continue with Apple
        </button>
        <button
          onClick={() => socialSignIn("google")}
          disabled={busy}
          className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-ink bg-white px-5 py-3 font-bold transition hover:bg-cream disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          Continue with Google
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs font-bold text-ink/60">
        <span className="h-px flex-1 bg-ink/15" /> OR USE EMAIL <span className="h-px flex-1 bg-ink/15" />
      </div>

      <form onSubmit={submitEmail} className="space-y-3">
        {mode === "signup" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={60}
            placeholder="Your name"
            aria-label="Your name"
            className="w-full rounded-2xl border-2 border-transparent bg-white px-4 py-3.5 outline-none focus:border-ink md:border-ink/15 md:bg-paper md:hover:border-ink/30 md:focus:border-ink"
          />
        )}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="Email"
          aria-label="Email"
          className="w-full rounded-2xl border-2 border-transparent bg-white px-4 py-3.5 outline-none focus:border-ink md:border-ink/15 md:bg-paper md:hover:border-ink/30 md:focus:border-ink"
        />
        <input
          type="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
          aria-label="Password"
          className="w-full rounded-2xl border-2 border-transparent bg-white px-4 py-3.5 outline-none focus:border-ink md:border-ink/15 md:bg-paper md:hover:border-ink/30 md:focus:border-ink"
        />

        {error && (
          <p className="rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-[#8A1C0B] md:bg-[#FFE4E0]" role="alert">
            {error}
            {unverified && (
              <button type="button" onClick={resendVerification} className="ml-1 underline">
                Resend verification email
              </button>
            )}
          </p>
        )}
        {notice && (
          <p className="rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold md:bg-cream" role="status">
            {notice}
          </p>
        )}

        <button
          disabled={busy}
          className="w-full rounded-full bg-ink px-5 py-3.5 text-lg font-extrabold text-white transition hover:bg-black disabled:opacity-60"
        >
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <div className="flex items-center justify-between text-sm font-semibold">
        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
          className="underline"
        >
          {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
        {mode === "signin" && (
          <button onClick={resetPassword} className="text-ink/70 underline">
            Forgot password?
          </button>
        )}
      </div>
    </div>
  );
}
