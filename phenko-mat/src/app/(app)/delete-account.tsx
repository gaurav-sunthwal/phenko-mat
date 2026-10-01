import { SheetScreen } from "@/components/ui";
import { DeleteAccountForm } from "@/features/profile/components/DeleteAccountForm";

export default function DeleteAccountSheet() {
  return (
    <SheetScreen title="Delete account">
      <DeleteAccountForm />
    </SheetScreen>
  );
}
