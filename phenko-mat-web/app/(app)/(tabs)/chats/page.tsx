import { ChatList } from "@/components/ChatList";
import { ChatIcon } from "@/components/icons";

export default function ChatsPage() {
  return (
    <div className="flex flex-1 flex-col md:h-dvh md:flex-row">
      <div className="flex flex-1 flex-col md:w-80 md:flex-none md:overflow-y-auto md:border-r md:border-line lg:w-96">
        <ChatList />
      </div>
      {/* Big screens: the thread opens here, next to the list. */}
      <div className="hidden flex-1 flex-col items-center justify-center gap-3 px-8 text-center text-ink-soft md:flex">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-cream text-ink">
          <ChatIcon size={34} />
        </span>
        <p className="text-lg font-bold text-ink">Pick a conversation</p>
        <p className="max-w-xs text-sm">Your chats with people giving and taking things show up on the left.</p>
      </div>
    </div>
  );
}
