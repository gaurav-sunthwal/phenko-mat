"use client";

import { create } from "zustand";
import type { Condition, FeedItem } from "@/lib/dto";

export const MAX_PHOTOS = 6;
export const MAX_CATEGORIES = 5;

/** A photo in the form: a local pick (`file` + blob preview) or one the listing already has (`file: null`). */
export interface DraftPhoto {
  preview: string;
  file: File | null;
}

interface ListingDraft {
  /** Listing being edited (edit draft only); null for a new listing. */
  itemId: string | null;
  photos: DraftPhoto[];
  /** preview → uploaded URL, so retrying a failed publish doesn't upload the same photo twice. */
  uploaded: Record<string, string>;
  title: string;
  description: string;
  categoryIds: string[];
  condition: Condition;
  free: boolean;
  price: string;
  /** Pickup spot chosen for this listing; null = the owner's profile location (new listings only). */
  location: { lat: number; lng: number; area: string } | null;

  set: (patch: Partial<Pick<ListingDraft, "title" | "description" | "condition" | "free" | "price" | "location">>) => void;
  addFiles: (files: File[]) => void;
  removePhoto: (preview: string) => void;
  markUploaded: (preview: string, url: string) => void;
  toggleCategory: (id: string) => void;
  addCategory: (id: string) => void;
  /** Fills the form from an existing listing; its photos count as already uploaded. */
  load: (item: FeedItem) => void;
  reset: () => void;
}

const initial = {
  itemId: null,
  photos: [] as DraftPhoto[],
  uploaded: {} as Record<string, string>,
  title: "",
  description: "",
  categoryIds: [] as string[],
  condition: "good" as Condition,
  free: true,
  price: "",
  location: null as { lat: number; lng: number; area: string } | null,
};

const revokeLocal = (photos: DraftPhoto[]) => photos.forEach((p) => p.file && URL.revokeObjectURL(p.preview));

const createDraft = () =>
  create<ListingDraft>()((set) => ({
    ...initial,
    set: (patch) => set(patch),
    addFiles: (files) =>
      set((s) => {
        // Skip a photo that's already in the draft (same file picked twice), like the app.
        const key = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;
        const have = new Set(s.photos.flatMap((p) => (p.file ? [key(p.file)] : [])));
        const fresh = files.filter((f) => !have.has(key(f)) && (have.add(key(f)), true));
        return {
          photos: [
            ...s.photos,
            ...fresh.slice(0, MAX_PHOTOS - s.photos.length).map((file) => ({ file, preview: URL.createObjectURL(file) })),
          ],
        };
      }),
    removePhoto: (preview) =>
      set((s) => {
        revokeLocal(s.photos.filter((p) => p.preview === preview));
        return { photos: s.photos.filter((p) => p.preview !== preview) };
      }),
    markUploaded: (preview, url) => set((s) => ({ uploaded: { ...s.uploaded, [preview]: url } })),
    toggleCategory: (id) =>
      set((s) => ({
        categoryIds: s.categoryIds.includes(id)
          ? s.categoryIds.filter((x) => x !== id)
          : s.categoryIds.length < MAX_CATEGORIES
            ? [...s.categoryIds, id]
            : s.categoryIds,
      })),
    addCategory: (id) =>
      set((s) =>
        s.categoryIds.includes(id) || s.categoryIds.length >= MAX_CATEGORIES ? s : { categoryIds: [...s.categoryIds, id] },
      ),
    load: (item) =>
      set((s) => {
        revokeLocal(s.photos);
        return {
          ...initial,
          itemId: item.id,
          photos: item.photos.map((url) => ({ preview: url, file: null })),
          uploaded: Object.fromEntries(item.photos.map((url) => [url, url])),
          title: item.title,
          description: item.description,
          categoryIds: item.categoryIds,
          condition: item.condition,
          free: item.priceInr === 0,
          price: item.priceInr === 0 ? "" : String(item.priceInr),
          location: item.location ? { ...item.location, area: item.area } : null,
        };
      }),
    reset: () =>
      set((s) => {
        revokeLocal(s.photos);
        return initial;
      }),
  }));

/**
 * The listing form lives in a store, not component state, so a half-written listing survives leaving
 * the page (like the app). New and edit drafts are kept apart so editing never clobbers a new one.
 */
export type ListingDraftStore = ReturnType<typeof createDraft>;

export const useListingDraft = createDraft();
export const useEditDraft = createDraft();
