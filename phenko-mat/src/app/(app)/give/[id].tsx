import { useLocalSearchParams } from "expo-router";
import { SheetScreen } from "@/components/ui";
import { WhoGotItForm } from "@/features/profile/components/WhoGotItForm";

/** Form sheet opened by "Mark as given" when people have connected on the item. */
export default function WhoGotItSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SheetScreen title="Who got it?">
      <WhoGotItForm itemId={id} />
    </SheetScreen>
  );
}
