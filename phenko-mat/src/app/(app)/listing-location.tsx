import { useLocalSearchParams } from "expo-router";
import { useEditDraft, useListingDraft } from "@/features/listing/draft";
import { closePickupLocation, PickupLocationScreen } from "@/features/location/PickupLocationScreen";
import { useMe } from "@/features/profile/api";

/** Pickup spot for the listing being written (`?for=listing`) or edited (`?for=edit`). */
export default function ListingLocationRoute() {
  const { for: target } = useLocalSearchParams<{ for?: string }>();
  const store = target === "edit" ? useEditDraft : useListingDraft;
  const chosen = store((s) => s.location);
  const { data: me } = useMe();
  const profilePlace = me?.location && me.area ? { ...me.location, area: me.area } : null;

  return (
    <PickupLocationScreen
      initial={chosen ?? profilePlace}
      onSave={(place) => {
        store.getState().set({ location: place });
        closePickupLocation();
      }}
      onUseProfileArea={
        chosen && profilePlace
          ? () => {
              // A new listing falls back to the profile area by itself; an edit has to send it.
              store.getState().set({ location: target === "edit" ? profilePlace : null });
              closePickupLocation();
            }
          : undefined
      }
    />
  );
}
