import type { Metadata } from "next";
import { PublicProfileView } from "@/components/PublicProfileView";

export const metadata: Metadata = { title: "Profile" };

export default async function PublicProfilePage({ params }: PageProps<"/u/[id]">) {
  const { id } = await params;
  return <PublicProfileView key={id} id={id} />;
}
