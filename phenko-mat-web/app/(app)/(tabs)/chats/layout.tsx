import type { Metadata } from "next";

export const metadata: Metadata = { title: "Chats" };

export default function ChatsLayout({ children }: LayoutProps<"/chats">) {
  return children;
}
