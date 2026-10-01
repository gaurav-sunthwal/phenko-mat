import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { LoginButton } from "./LoginButton";

export const metadata: Metadata = { title: "Sign in · Phenko Mat Admin" };

export default async function LoginPage() {
  if (await getAdmin().catch(() => null)) redirect("/");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
        <p className="text-xs font-bold tracking-widest text-amber-600 uppercase">Phenko Mat</p>
        <h1 className="mt-1 text-2xl font-black text-zinc-900">Admin panel</h1>
        <p className="mt-2 text-sm text-zinc-500">Sign in with an admin Google account.</p>
        <LoginButton />
      </div>
    </main>
  );
}
