import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ErrorNote, Spinner } from "@/components/ui";
import { useItem } from "@/features/listing/api";
import { useEditDraft } from "@/features/listing/draft";
import { EditItemForm } from "@/features/listing/NewItemForm";
import { errorMessage } from "@/lib/api/errors";
import type { FeedItem } from "@/shared/dto";

export default function EditListingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: item, error, refetch } = useItem(id);

  if (error) return <ErrorNote message={errorMessage(error)} onRetry={() => void refetch()} />;
  if (!item) return <Spinner />;
  return <Editor key={item.id} item={item} />;
}

function Editor({ item }: { item: FeedItem }) {
  // Load the listing into the draft once, before the form subscribes; later refetches must not wipe edits.
  useState(() => useEditDraft.getState().load(item));
  return <EditItemForm item={item} />;
}
