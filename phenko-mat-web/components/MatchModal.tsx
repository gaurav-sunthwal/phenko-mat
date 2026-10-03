"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUi, type PendingMatch } from "@/lib/client/stores/ui";
import { HeartIcon } from "./icons";
import { Avatar, Photo } from "./ui";

export function MatchModal() {
  const match = useUi((s) => s.match);
  // Keyed per match so "Opening chat…" never carries over to the next one.
  return match ? <MatchOverlay key={match.itemId} match={match} /> : null;
}

function MatchOverlay({ match }: { match: PendingMatch }) {
  const showMatch = useUi((s) => s.showMatch);
  const router = useRouter();
  /** "Send a message" was pressed before the swipe request returned the chat id. */
  const [waitingForChat, setWaitingForChat] = useState(false);
  const close = () => showMatch(null);

  // Open the chat as soon as its id is known (immediately if it already is).
  const { connectionId } = match;
  useEffect(() => {
    if (!waitingForChat || !connectionId) return;
    showMatch(null);
    router.push(`/chat/${connectionId}`);
  }, [waitingForChat, connectionId, showMatch, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && showMatch(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showMatch]);

  return (
    <div
      className="animate-fade fixed inset-0 z-[60] flex items-center justify-center bg-honey px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-title"
    >
      <div className="w-full max-w-sm text-center">
        <div className="animate-pop relative mx-auto mb-8 flex h-44 w-72 items-center justify-center">
          <div className="absolute left-4 h-40 w-32 -rotate-6 overflow-hidden rounded-3xl border-4 border-white shadow-xl">
            <Photo src={match.item.photo} alt={match.item.title} sizes="128px" />
          </div>
          <div className="absolute right-4 flex h-40 w-32 rotate-6 items-center justify-center rounded-3xl border-4 border-white bg-cream shadow-xl">
            <Avatar user={match.other} size={88} />
          </div>
          <span className="absolute z-10 flex h-14 w-14 items-center justify-center rounded-full bg-white text-ink shadow-lg">
            <HeartIcon size={28} filled />
          </span>
        </div>

        <h2 id="match-title" className="text-4xl leading-tight font-black">
          It&apos;s a connection!
        </h2>
        <p className="mt-3 text-lg">
          {match.other.name.split(" ")[0]} is passing on <strong>{match.item.title}</strong>. Say hi and plan the
          pickup.
        </p>

        {match.error && (
          <p className="mt-5 rounded-xl bg-cream px-3 py-2.5 font-semibold" role="alert">
            {match.error}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {!match.error && (
            <button
              autoFocus
              disabled={waitingForChat}
              onClick={() => setWaitingForChat(true)}
              className="rounded-full bg-ink px-6 py-4 text-lg font-bold text-white transition hover:bg-black disabled:opacity-70"
            >
              {waitingForChat ? "Opening chat…" : "Send a message"}
            </button>
          )}
          <button
            autoFocus={Boolean(match.error)}
            onClick={close}
            className="rounded-full border-2 border-ink px-6 py-4 text-lg font-bold transition hover:bg-ink/5"
          >
            Keep swiping
          </button>
        </div>
      </div>
    </div>
  );
}
