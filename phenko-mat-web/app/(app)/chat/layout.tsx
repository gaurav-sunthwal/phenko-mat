import type { ReactNode } from "react";
import { ChatList } from "@/components/ChatList";

/** md and up: keep the conversation list beside the open thread. Phones: the thread alone. */
export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden h-dvh w-80 shrink-0 flex-col overflow-y-auto border-r border-line md:flex lg:w-96">
        <ChatList />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
