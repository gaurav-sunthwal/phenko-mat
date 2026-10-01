import { router, useLocalSearchParams } from "expo-router";
import { SheetScreen } from "@/components/ui";
import { LocationForm } from "@/features/location/LocationForm";
import { useMe } from "@/features/profile/api";
import { useUi } from "@/stores/ui";

/** Form sheet. `?then=nearby` switches the feed to "Nearby" after saving (feed's scope toggle). */
export default function LocationSheet() {
  const { then } = useLocalSearchParams<{ then?: string }>();
  const { data: me } = useMe();
  const setFeedScope = useUi((s) => s.setFeedScope);

  return (
    <SheetScreen title="Your location">
      <LocationForm
        key={me?.id ?? "loading"}
        me={me}
        onDone={() => {
          if (then === "nearby") setFeedScope("nearby");
          router.back();
        }}
      />
    </SheetScreen>
  );
}
