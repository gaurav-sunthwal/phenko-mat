import type { Metadata } from "next";
import { ListingPreview } from "@/components/ListingPreview";

export const metadata: Metadata = { title: "Preview" };

export default async function ListingPreviewPage({ params }: PageProps<"/listing/[id]">) {
  const { id } = await params;
  return <ListingPreview key={id} id={id} />;
}
