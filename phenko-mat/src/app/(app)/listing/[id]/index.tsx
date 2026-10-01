import { useLocalSearchParams } from "expo-router";
import { ListingPreview } from "@/features/listing/ListingPreview";

export default function ListingPreviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ListingPreview key={id} id={id} />;
}
