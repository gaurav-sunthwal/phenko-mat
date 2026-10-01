import { Redirect } from "expo-router";
import { useAuth } from "@/features/auth/store";

export default function Index() {
  const status = useAuth((s) => s.status);
  if (status === "initializing") return null;
  return <Redirect href={status === "signedIn" ? "/feed" : "/login"} />;
}
