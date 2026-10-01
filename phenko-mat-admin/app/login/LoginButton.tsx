"use client";

import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clientAuth } from "@/lib/firebase-client";

export function LoginButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const auth = await clientAuth();
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      const idToken = await cred.user.getIdToken(true);
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      await signOut(auth);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Couldn't sign in.");
      }
      router.replace("/");
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't sign in.";
      setError(message.includes("popup-closed") ? null : message);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={signIn}
        disabled={busy}
        className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-bold text-white hover:bg-black disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Continue with Google"}
      </button>
      {error && (
        <p className="mt-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
