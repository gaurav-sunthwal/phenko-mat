import { router, useLocalSearchParams } from "expo-router";
import { SheetScreen } from "@/components/ui";
import { NewCategoryForm } from "@/features/categories/components/NewCategoryForm";
import { useEditDraft, useListingDraft } from "@/features/listing/draft";

/** Form sheet. `?for=listing` (or `edit`) also selects the new category in that listing draft. */
export default function NewCategorySheet() {
  const { for: target } = useLocalSearchParams<{ for?: string }>();
  return (
    <SheetScreen title="New category">
      <NewCategoryForm
        onCreated={(c) => {
          if (target === "listing") useListingDraft.getState().addCategory(c.id);
          else if (target === "edit") useEditDraft.getState().addCategory(c.id);
          router.back();
        }}
      />
    </SheetScreen>
  );
}
