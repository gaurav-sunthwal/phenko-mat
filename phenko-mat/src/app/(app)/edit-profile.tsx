import { router } from "expo-router";
import { SheetScreen, Spinner } from "@/components/ui";
import { useMe } from "@/features/profile/api";
import { EditProfileForm } from "@/features/profile/components/EditProfileForm";

export default function EditProfileSheet() {
  const { data: me } = useMe();
  return (
    <SheetScreen title="Edit profile">
      {me ? <EditProfileForm me={me} onDone={() => router.back()} /> : <Spinner />}
    </SheetScreen>
  );
}
