import { useLocalSearchParams } from "expo-router";
import { PublicProfileScreen } from "@/features/people/PublicProfileScreen";

export default function UserProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PublicProfileScreen key={id} id={id} />;
}
