import type { ReactNode } from "react";
import { signOut } from "@/app/actions";
import { NavLinks } from "@/components/NavLinks";
import { requireAdmin } from "@/lib/auth";

/** Every panel page: verified admin session, sidebar navigation. */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col border-r border-zinc-200 bg-white px-4 py-6">
        <p className="px-2 text-xs font-bold tracking-widest text-amber-600 uppercase">Phenko Mat</p>
        <p className="px-2 text-lg font-black">Admin</p>
        <NavLinks />
        <div className="mt-auto border-t border-zinc-200 px-2 pt-4">
          <p className="truncate text-xs text-zinc-500" title={admin.email}>
            {admin.email}
          </p>
          <form action={signOut}>
            <button className="mt-2 text-sm font-semibold text-zinc-700 hover:text-black">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
