"use client";

import { useState } from "react";
import { useListingActions } from "@/lib/client/listings";
import { useUi } from "@/lib/client/stores/ui";
import { Avatar, Sheet } from "./ui";

/** "Mark as given" when people connected on the item: pick who got it (counts toward their "Received"). */
export function GiveSheet() {
  const itemId = useUi((s) => s.givingItemId);
  const setGivingItemId = useUi((s) => s.setGivingItemId);
  const close = () => setGivingItemId(null);

  return (
    <Sheet open={itemId !== null} onClose={close} title="Who got it?">
      {itemId && <WhoGotIt key={itemId} itemId={itemId} onDone={close} />}
    </Sheet>
  );
}

function WhoGotIt({ itemId, onDone }: { itemId: string; onDone: () => void }) {
  const { setStatus, takersOf } = useListingActions();
  // Snapshot once: the list must not shift under the pointer while the chats list refreshes.
  const [people] = useState(() => takersOf(itemId));

  function choose(givenToId: string | null) {
    void setStatus(itemId, "given", givenToId);
    onDone();
  }

  return (
    <div className="space-y-2">
      <p className="mb-3 text-sm text-ink-soft">It will show up in their “Received” count.</p>
      {people.map((p) => (
        <button
          key={p.id}
          onClick={() => choose(p.id)}
          className="flex w-full items-center gap-3 rounded-2xl bg-paper p-3 text-left transition hover:bg-cream"
        >
          <Avatar user={p} size={40} />
          <span className="truncate font-bold">{p.name}</span>
        </button>
      ))}
      <button
        onClick={() => choose(null)}
        className="w-full rounded-2xl border border-line p-3 font-bold text-ink-soft transition hover:bg-cream"
      >
        Someone else
      </button>
    </div>
  );
}
