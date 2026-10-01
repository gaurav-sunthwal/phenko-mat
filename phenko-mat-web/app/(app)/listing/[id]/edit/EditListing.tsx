"use client";

import { useState } from "react";
import { ErrorNote, Spinner } from "@/components/ui";
import { useItem } from "@/lib/client/hooks";
import { useEditDraft } from "@/lib/client/stores/listingDraft";
import type { FeedItem } from "@/lib/dto";
import { EditItemForm } from "../../../new/NewItemForm";

export function EditListing({ id }: { id: string }) {
  const { data: item, error, mutate } = useItem(id);

  if (error) return <ErrorNote message={error.message} onRetry={() => mutate()} />;
  if (!item) return <Spinner />;
  return <Editor key={item.id} item={item} />;
}

function Editor({ item }: { item: FeedItem }) {
  // Load once, before the form subscribes; later refetches must not wipe edits. Coming back to the
  // same listing keeps the unsaved edits (the draft survives leaving the page).
  useState(() => {
    if (useEditDraft.getState().itemId !== item.id) useEditDraft.getState().load(item);
  });
  return <EditItemForm item={item} />;
}
