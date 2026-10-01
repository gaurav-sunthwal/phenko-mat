import type { Metadata } from "next";
import { GiveSheet } from "@/components/GiveSheet";
import { MatchModal } from "@/components/MatchModal";
import { PhoneFrame } from "@/components/AppShell";
import { RealtimeProvider } from "@/components/RealtimeProvider";
import { Toast } from "@/components/Toast";
import { WelcomeOnFirstRun } from "@/components/WelcomeOnFirstRun";

/** Signed-in screens are personal; they should never appear in search results. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <PhoneFrame>
      {children}
      <MatchModal />
      <GiveSheet />
      <Toast />
      <WelcomeOnFirstRun />
      <RealtimeProvider />
    </PhoneFrame>
  );
}
