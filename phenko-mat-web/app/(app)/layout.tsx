import type { Metadata } from "next";
import { ClarityIdentify, ClarityMask } from "@/components/Clarity";
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
    // Personal content (chats, names, listings) is masked in session recordings.
    <ClarityMask>
      <PhoneFrame>
        {children}
        <MatchModal />
        <GiveSheet />
        <Toast />
        <WelcomeOnFirstRun />
        <RealtimeProvider />
        <ClarityIdentify />
      </PhoneFrame>
    </ClarityMask>
  );
}
