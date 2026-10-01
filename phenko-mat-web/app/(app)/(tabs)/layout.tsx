import { AppHeader, TabBar } from "@/components/AppShell";

export default function TabsLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <TabBar />
    </>
  );
}
