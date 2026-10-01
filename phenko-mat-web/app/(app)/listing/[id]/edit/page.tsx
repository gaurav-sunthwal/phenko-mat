import type { Metadata } from "next";
import { EditListing } from "./EditListing";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }: PageProps<"/listing/[id]/edit">) {
  const { id } = await params;
  return <EditListing key={id} id={id} />;
}
