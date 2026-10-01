"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TrashIcon, XIcon } from "@/components/icons";
import { Avatar, EmptyState, ErrorNote, Photo, Spinner } from "@/components/ui";
import { useDeleteChat } from "@/lib/client/connections";
import { useConnections } from "@/lib/client/hooks";
import type { ConnectionSummary } from "@/lib/dto";
import { timeAgo } from "@/lib/format";
import { useNow } from "@/lib/useNow";

/**
 * Connections list. Phones: the whole Chats screen. md and up: the left column of the chat split
 * view (next to the open thread), with the open chat highlighted.
 */
export function ChatList() {
  const { data, error, isLoading, mutate } = useConnections();
  const now = useNow();
  const pathname = usePathname();
  const openId = pathname.startsWith("/chat/") ? pathname.slice("/chat/".length) : null;
  const router = useRouter();
  const deleteChat = useDeleteChat();

  // Web's stand-in for the app's long-press: a delete button on hover (always shown on touch screens).
  function remove(c: ConnectionSummary) {
    if (deleteChat(c) && openId === c.id) router.replace("/chats");
  }
  const revealOnHover =
    "opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100";

  if (error) return <ErrorNote message={error.message} onRetry={() => mutate()} />;
  if (isLoading || !data) return <Spinner />;
  if (data.length === 0) {
    return (
      <EmptyState
        emoji="💬"
        title="No connections yet"
        body="Swipe right on something you'd like, and you'll be able to chat with the person giving it away."
        action={
          <Link href="/feed" className="rounded-full bg-ink px-6 py-3 font-bold text-white">
            Start swiping
          </Link>
        }
      />
    );
  }

  const fresh = data.filter((c) => !c.lastMessage);
  const active = data.filter((c) => c.lastMessage);

  return (
    <div className="pb-6">
      <h1 className="px-4 pt-2 text-3xl font-black md:pt-8">Connections</h1>

      {fresh.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-3 px-4 text-sm font-bold text-ink-soft">New — make the first move</h2>
          <ul className="flex gap-4 overflow-x-auto px-4 pb-2">
            {fresh.map((c) => (
              <li key={c.id} className="group relative shrink-0">
                <button
                  onClick={() => remove(c)}
                  className={`absolute -top-1 -right-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white ${revealOnHover}`}
                  aria-label={`Delete chat with ${c.other.name}`}
                  title="Delete chat"
                >
                  <XIcon size={13} />
                </button>
                <Link href={`/chat/${c.id}`} className="flex w-20 flex-col items-center gap-1.5 text-center">
                  <span className="relative block h-20 w-20 overflow-hidden rounded-full ring-4 ring-honey">
                    <Photo src={c.item.photo} alt={c.item.title} sizes="80px" />
                  </span>
                  <span className="line-clamp-1 text-xs font-bold">{c.other.name.split(" ")[0]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {active.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-1 px-4 text-sm font-bold text-ink-soft">Chats</h2>
          <ul>
            {active.map((c) => (
              <li key={c.id} className="group relative">
                <Link
                  href={`/chat/${c.id}`}
                  aria-current={openId === c.id ? "page" : undefined}
                  className={`flex items-center gap-3 px-4 py-3 transition hover:bg-white ${openId === c.id ? "bg-white" : ""}`}
                >
                  <span className="relative shrink-0">
                    <span className="relative block h-14 w-14 overflow-hidden rounded-2xl">
                      <Photo src={c.item.photo} alt="" sizes="56px" />
                    </span>
                    <span className="absolute -right-1.5 -bottom-1.5">
                      <Avatar user={c.other} size={26} ring />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-bold">{c.other.name}</span>
                      <span className="shrink-0 text-xs text-ink-soft">{timeAgo(c.lastMessage!.createdAt, now)}</span>
                    </span>
                    <span className="block truncate text-xs font-semibold text-ink-soft">
                      {c.role === "giver" ? "Wants your" : "Giving"} {c.item.title}
                    </span>
                    <span className={`block truncate text-sm ${c.unread ? "font-bold text-ink" : "text-ink-soft"}`}>
                      {c.lastMessage!.mine ? "You: " : ""}
                      {c.lastMessage!.body}
                    </span>
                  </span>
                  {c.unread > 0 && (
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-honey px-1.5 text-xs font-extrabold">
                      {c.unread}
                    </span>
                  )}
                  {/* Keeps the text clear of the delete button. */}
                  <span className="w-8 shrink-0" aria-hidden="true" />
                </Link>
                <button
                  onClick={() => remove(c)}
                  className={`absolute top-1/2 right-3 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft hover:bg-[#FFE4E0] hover:text-[#B42318] ${revealOnHover}`}
                  aria-label={`Delete chat with ${c.other.name}`}
                  title="Delete chat"
                >
                  <TrashIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
