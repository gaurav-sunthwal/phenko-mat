import type { Metadata } from "next";
import { NewItemForm } from "./NewItemForm";

export const metadata: Metadata = { title: "List an item" };

export default function NewItemPage() {
  return <NewItemForm />;
}
