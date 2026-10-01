"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, CheckIcon, MoreIcon, SendIcon, TrashIcon } from "@/components/icons";
import { ReportSheet } from "@/components/ReportSheet";
import { Avatar, EmptyState, ErrorNote, Photo, Spinner } from "@/components/ui";
import { ApiRequestError } from "@/lib/client/api";
import { useDeleteChat } from "@/lib/client/connections";
import { useConnection } from "@/lib/client/hooks";
import { useListingActions } from "@/lib/client/listings";
import { useBlockUser, type ReportTarget } from "@/lib/client/safety";
import { sendTyping } from "@/lib/client/realtime";
import { useChatStore } from "@/lib/client/stores/chat";
import { useChat } from "@/lib/client/useChat";
import { formatPrice } from "@/lib/format";

const TAKER_QUICK_REPLIES = ["Hi! Is this still available?", "When can I pick it up?", "Could you share more photos?"];
const GIVER_QUICK_REPLIES = ["Yes, it's still available!", "I'm free this evening.", "Where would suit you for pickup?"];

export function ChatThread({ id }: { id: string }) {
  const { data: connection, error: connError } = useConnection(id);
  const { messages, pending, typing, liveReadAt, connected, send, retry, hasOlder, loadingOlder, loadOlder } = useChat(id);
  const block = useBlockUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const listing = useListingActions();
  const deleteChat = useDeleteChat();
  const bottom = useRef<HTMLDivElement>(null);

  // Deleted live: by the other person → show that the chat has ended; by me (maybe on another device) → leave.
  const removedBy = useChatStore((s) => s.removed[id]);
  const otherId = connection?.other.id;
  const endedByOther = removedBy !== undefined && removedBy === otherId;
  useEffect(() => {
    if (removedBy !== undefined && removedBy !== otherId) router.replace("/chats");
  }, [removedBy, otherId, router]);

  // Only when something new arrives at the bottom, not when older messages load at the top.
  const newestId = messages?.at(-1)?.id;
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [newestId, pending.length, typing]);

  function submit(text: string) {
    const body = text.trim();
    if (!body) return;
    setDraft("");
    setSendError(null);
    // Optimistic: the bubble shows immediately; failures stay in place with a retry button.
    send(body).catch((e: unknown) =>
      setSendError(e instanceof ApiRequestError ? e.message : "Message not sent. Tap it to retry."),
    );
  }

  function markGiven() {
    // Same as the profile: asks "Who got it?" when people connected, updates everywhere at once.
    if (connection) listing.markGiven(connection.item.id);
  }

  function removeChat() {
    // Leave straight away; the delete finishes in the background (and undoes itself if it fails).
    if (connection && deleteChat(connection)) router.replace("/chats");
  }

  if (endedByOther) {
    return (
      <div className="flex h-dvh flex-col">
        <EmptyState
          emoji="👋"
          title="Chat ended"
          body={`${connection!.other.name.split(" ")[0]} removed this chat, so you're no longer connected.`}
          action={
            <Link href="/chats" className="rounded-full bg-ink px-6 py-3 font-bold text-white">
              Back to chats
            </Link>
          }
        />
      </div>
    );
  }
  if (connError) return <ErrorNote message={connError.message} />;
  if (!connection) return <Spinner />;

  const quickReplies = connection.role === "taker" ? TAKER_QUICK_REPLIES : GIVER_QUICK_REPLIES;
  const given = connection.item.status !== "active";
  const readUpTo = new Date(liveReadAt ?? connection.otherReadAt).getTime();
  const firstName = connection.other.name.split(" ")[0];

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-white px-3 py-3">
        <Link
          href="/chats"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-cream md:hidden"
          aria-label="Back"
        >
          <ArrowLeftIcon size={20} />
        </Link>
        <Link
          href={`/u/${connection.other.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
          aria-label={`View ${connection.other.name}'s profile`}
        >
          <Avatar user={connection.other} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold hover:underline">{connection.other.name}</p>
            <p className="truncate text-xs text-ink-soft">
              {typing ? (
                <span className="font-semibold text-ink">typing…</span>
              ) : connection.role === "giver" ? (
                "Wants your item"
              ) : (
                "Giving this away"
              )}
            </p>
          </div>
        </Link>
        {!connected && (
          <span className="rounded-full bg-cream px-2 py-1 text-[11px] font-bold text-ink-soft" role="status">
            Reconnecting…
          </span>
        )}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-cream hover:text-ink"
            aria-label="Chat options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <MoreIcon size={20} />
          </button>
          {menuOpen && (
            <>
              <button
                className="fixed inset-0 z-30 cursor-default"
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => setMenuOpen(false)}
              />
              <div
                role="menu"
                className="absolute top-11 right-0 z-40 w-56 overflow-hidden rounded-2xl bg-white py-1 shadow-xl ring-1 ring-line"
              >
                <Link
                  role="menuitem"
                  href={`/u/${connection.other.id}`}
                  className="block px-4 py-2.5 text-sm font-semibold hover:bg-cream"
                >
                  View {firstName}&apos;s profile
                </Link>
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setReporting({ kind: "user", id: connection.other.id, name: connection.other.name });
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm font-semibold hover:bg-cream"
                >
                  Report {firstName}
                </button>
                <button
                  role="menuitem"
                  onClick={async () => {
                    setMenuOpen(false);
                    if (await block(connection.other)) router.replace("/chats");
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-[#B42318] hover:bg-[#FFE4E0]"
                >
                  Block {firstName}
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    removeChat();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-ink-soft hover:bg-cream"
                >
                  <TrashIcon size={15} /> Delete chat
                </button>
              </div>
            </>
          )}
        </div>
      </header>
      <ReportSheet target={reporting} onClose={() => setReporting(null)} />

      <div className="flex items-center gap-3 border-b border-line bg-cream px-4 py-3">
        {/* Opens the listing (removed ones can't be opened any more). */}
        <Link
          href={`/listing/${connection.item.id}`}
          aria-disabled={connection.item.status === "removed"}
          className={`flex min-w-0 flex-1 items-center gap-3 ${connection.item.status === "removed" ? "pointer-events-none" : "group"}`}
        >
          <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-xl">
            <Photo src={connection.item.photo} alt={connection.item.title} sizes="48px" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold group-hover:underline">{connection.item.title}</p>
            <p className="text-xs text-ink-soft">
              {formatPrice(connection.item.priceInr)}
              {given && " · no longer available"}
              {!given && " · view listing"}
            </p>
          </div>
        </Link>
        {connection.role === "giver" && !given && (
          <button
            onClick={markGiven}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink px-3 py-2 text-xs font-bold text-white"
          >
            <CheckIcon size={14} /> Mark as given
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {!messages ? (
          <Spinner />
        ) : (
          <>
            {hasOlder && (
              <button
                onClick={() => void loadOlder()}
                disabled={loadingOlder}
                className="mx-auto mb-4 block rounded-full bg-white px-4 py-2 text-xs font-bold text-ink-soft shadow-sm hover:text-ink disabled:opacity-60"
              >
                {loadingOlder ? "Loading…" : "Load earlier messages"}
              </button>
            )}
            {!hasOlder && (
              <p className="mx-auto mb-4 max-w-xs rounded-2xl bg-white px-4 py-3 text-center text-xs text-ink-soft">
                You connected over <strong className="text-ink">{connection.item.title}</strong>. Meet somewhere public and check
                the item before paying.
              </p>
            )}
            <ul className="space-y-2">
              {messages.map((m) => (
                <li key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  <Bubble
                    mine={m.mine}
                    body={m.body}
                    time={m.createdAt}
                    status={m.mine ? (new Date(m.createdAt).getTime() <= readUpTo ? "read" : "sent") : undefined}
                  />
                </li>
              ))}
              {pending.map((p) => (
                <li key={p.clientId} className="flex flex-col items-end">
                  <Bubble mine body={p.body} time={p.createdAt} status={p.status === "failed" ? "failed" : "sending"} />
                  {p.status === "failed" && (
                    <button onClick={() => retry(p.clientId)} className="mt-1 text-xs font-bold text-[#B42318] underline">
                      Not sent · tap to retry
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {typing && (
              <p
                className="mt-2 inline-flex items-center gap-1 rounded-3xl rounded-bl-md bg-white px-4 py-3"
                aria-label={`${firstName} is typing`}
              >
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="h-2 w-2 animate-bounce rounded-full bg-ink-soft"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </p>
            )}
          </>
        )}
        <div ref={bottom} />
      </div>

      {messages?.length === 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-2">
          {quickReplies.map((q) => (
            <button
              key={q}
              onClick={() => submit(q)}
              className="shrink-0 rounded-full border-2 border-ink px-3 py-1.5 text-sm font-semibold hover:bg-ink hover:text-white"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {sendError && (
        <p className="px-4 pb-1 text-sm text-[#B42318]" role="alert">
          {sendError}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
        className="flex items-end gap-2 border-t border-line bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <label htmlFor="message" className="sr-only">
          Message
        </label>
        <textarea
          id="message"
          rows={1}
          value={draft}
          maxLength={2000}
          onChange={(e) => {
            setDraft(e.target.value);
            if (e.target.value.trim()) sendTyping(id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(draft);
            }
          }}
          placeholder="Write a message…"
          className="max-h-32 flex-1 resize-none rounded-3xl bg-paper px-4 py-3 outline-none focus:ring-2 focus:ring-honey"
        />
        <button
          disabled={!draft.trim()}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-honey text-ink transition disabled:opacity-40"
          aria-label="Send"
        >
          <SendIcon size={20} />
        </button>
      </form>
    </div>
  );
}

type BubbleStatus = "sending" | "sent" | "read" | "failed";

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

function Ticks({ status }: { status: BubbleStatus }) {
  if (status === "sending") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-label="Sending">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "failed") return <span aria-label="Not sent">!</span>;
  const read = status === "read";
  return (
    <svg
      width="18"
      height="12"
      viewBox="0 0 28 16"
      fill="none"
      stroke={read ? "#1D72F3" : "currentColor"}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={read ? "Read" : "Sent"}
    >
      <path d="M1.5 8.5 6 13 15 3" />
      {read && <path d="M11 13 20 3" />}
    </svg>
  );
}

function Bubble({ mine, body, time, status }: { mine: boolean; body: string; time: string; status?: BubbleStatus }) {
  return (
    <div
      className={`max-w-[78%] rounded-3xl px-4 pt-2.5 pb-1.5 ${
        mine
          ? `rounded-br-md ${status === "failed" ? "bg-[#FFE4E0]" : status === "sending" ? "bg-honey/70" : "bg-honey"}`
          : "rounded-bl-md bg-white"
      }`}
    >
      <p className="whitespace-pre-wrap break-words text-ink">{body}</p>
      <p className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] ${mine ? "text-ink/60" : "text-ink-soft"}`}>
        {timeFormat.format(new Date(time))}
        {mine && status && <Ticks status={status} />}
      </p>
    </div>
  );
}
