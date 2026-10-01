"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useConnections } from "@/lib/client/hooks";
import { ChatIcon, GridIcon, PlusIcon, StackIcon, UserIcon } from "./icons";
import { LEGAL_LINKS } from "@/lib/site";
import { LogoMark, Wordmark } from "./ui";

const TABS = [
  { href: "/feed", label: "Feed", Icon: StackIcon },
  { href: "/categories", label: "Categories", Icon: GridIcon },
  { href: "/profile", label: "Profile", Icon: UserIcon },
] as const;

/** Sidebar order (desktop): Chats gets a proper entry instead of living in the header. */
const SIDE_NAV = [TABS[0], TABS[1], { href: "/chats", label: "Chats", Icon: ChatIcon }, TABS[2]] as const;

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`) || (href === "/chats" && pathname.startsWith("/chat/"));

function useUnread() {
  const { data } = useConnections();
  return data?.reduce((n, c) => n + c.unread, 0) ?? 0;
}

/** Phone-width header. From md up the sidebar carries the logo, "List item" and Chats instead. */
export function AppHeader() {
  const unread = useUnread();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-paper/90 px-4 py-3 backdrop-blur-md md:hidden">
      <Link href="/feed" aria-label="Home">
        <LogoMark size={40} />
      </Link>
      <div className="flex items-center gap-2">
        <Link
          href="/new"
          className="flex items-center gap-1.5 rounded-full bg-ink py-2 pr-4 pl-3 text-sm font-bold text-white transition hover:bg-black"
        >
          <PlusIcon size={18} strokeWidth={2.6} /> List item
        </Link>
        <Link
          href="/chats"
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm transition hover:bg-cream"
          aria-label={unread ? `Chats, ${unread} unread` : "Chats"}
        >
          <ChatIcon size={21} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-honey px-1 text-[11px] font-extrabold text-ink ring-2 ring-paper">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="sticky bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      aria-label="Main"
    >
      <ul className="grid grid-cols-3">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-xs font-bold transition ${
                  active ? "text-ink" : "text-ink-soft hover:text-ink"
                }`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full ${active ? "bg-honey" : ""}`}>
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Tablet/desktop navigation. md (iPad portrait): an icon rail. lg and up: full sidebar with labels.
 * Hidden on phones, which keep the header + bottom tab bar.
 */
export function SideNav() {
  const pathname = usePathname();
  const unread = useUnread();

  return (
    <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col border-r border-line bg-white/70 px-3 py-5 backdrop-blur-md md:flex lg:w-64 lg:px-5">
      <Link href="/feed" aria-label="Phenko Mat home" className="flex justify-center lg:justify-start lg:px-2">
        <span className="hidden lg:block">
          <Wordmark />
        </span>
        <span className="lg:hidden">
          <LogoMark size={40} />
        </span>
      </Link>

      <Link
        href="/new"
        className="mt-8 flex items-center justify-center gap-2 rounded-full bg-ink py-3 font-bold text-white transition hover:bg-black lg:px-5"
        aria-label="List an item"
        title="List an item"
      >
        <PlusIcon size={20} strokeWidth={2.6} />
        <span className="hidden lg:inline">List an item</span>
      </Link>

      <nav className="mt-6" aria-label="Main">
        <ul className="space-y-1">
          {SIDE_NAV.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            const badge = href === "/chats" && unread > 0 ? (unread > 9 ? "9+" : String(unread)) : null;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label={badge ? `${label}, ${unread} unread` : label}
                  title={label}
                  className={`relative flex items-center justify-center gap-3 rounded-2xl py-3 font-bold transition lg:justify-start lg:px-4 ${
                    active ? "bg-honey text-ink" : "text-ink-soft hover:bg-cream hover:text-ink"
                  }`}
                >
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                  <span className="hidden lg:inline">{label}</span>
                  {badge && (
                    <span className="absolute top-1.5 right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-extrabold text-white lg:static lg:ml-auto">
                      {badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav className="mt-auto hidden flex-wrap gap-x-3 gap-y-1 px-2 text-xs text-ink-soft lg:flex" aria-label="Help and legal">
        {LEGAL_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-ink">
            {l.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

/**
 * Phones: a single app-width column (same as the native app). md and up: sidebar + full-width content.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_#FFE8A3,_#FBF8F1_60%)] md:bg-paper md:bg-none">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] bg-paper sm:shadow-[0_0_60px_-20px_rgba(0,0,0,0.2)] md:max-w-none md:shadow-none">
        <SideNav />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
