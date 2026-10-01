import type { Metadata } from "next";
import { ChatThread } from "./ChatThread";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatPage({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  return <ChatThread id={id} />;
}
