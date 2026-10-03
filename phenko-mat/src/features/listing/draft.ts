import { create } from "zustand";
import type { PickedImage } from "@/lib/api/upload";
import type { Condition, FeedItem } from "@/shared/dto";

export const MAX_PHOTOS = 6;

export interface ListingPlace {
  lat: number;
  lng: number;
  /** The name others see, e.g. "Koregaon Park, Pune". */
  area: string;
}
export const MAX_CATEGORIES = 5;

interface ListingDraft {
  /** Picked photos, still on the device. Nothing is uploaded until the user publishes. */
  photos: PickedImage[];
  /** Local URI → uploaded URL, so retrying a failed publish doesn't upload the same photo twice. */
  uploaded: Record<string, string>;
  title: string;
  description: string;
  categoryIds: string[];
  condition: Condition;
  /** Whole rupees as typed; at least ₹1 (there are no free listings). */
  price: string;
  /** Pickup spot chosen for this listing; null = the owner's profile location (new listings only). */
  location: ListingPlace | null;

  set: (patch: Partial<Pick<ListingDraft, "title" | "description" | "condition" | "price" | "location">>) => void;
  addPhotos: (photos: PickedImage[]) => void;
  removePhoto: (localUri: string) => void;
  markUploaded: (localUri: string, url: string) => void;
  toggleCategory: (id: string) => void;
  addCategory: (id: string) => void;
  /** Fills the form from an existing listing; its photos count as already uploaded. */
  load: (item: FeedItem) => void;
  reset: () => void;
}

const initial = {
  photos: [] as PickedImage[],
  uploaded: {} as Record<string, string>,
  title: "",
  description: "",
  categoryIds: [] as string[],
  condition: "good" as Condition,
  price: "",
  location: null as ListingPlace | null,
};

const createDraft = () => create<ListingDraft>()((set) => ({
  ...initial,
  set: (patch) => set(patch),
  addPhotos: (photos) =>
    set((s) => ({
      photos: [...s.photos, ...photos.filter((p) => !s.photos.some((q) => q.uri === p.uri))].slice(0, MAX_PHOTOS),
    })),
  removePhoto: (uri) => set((s) => ({ photos: s.photos.filter((p) => p.uri !== uri) })),
  markUploaded: (uri, url) => set((s) => ({ uploaded: { ...s.uploaded, [uri]: url } })),
  toggleCategory: (id) =>
    set((s) => ({
      categoryIds: s.categoryIds.includes(id)
        ? s.categoryIds.filter((x) => x !== id)
        : s.categoryIds.length < MAX_CATEGORIES
          ? [...s.categoryIds, id]
          : s.categoryIds,
    })),
  addCategory: (id) =>
    set((s) => (s.categoryIds.includes(id) || s.categoryIds.length >= MAX_CATEGORIES ? s : { categoryIds: [...s.categoryIds, id] })),
  load: (item) =>
    set({
      ...initial,
      photos: item.photos.map((uri) => ({ uri, width: 0, height: 0 })),
      uploaded: Object.fromEntries(item.photos.map((url) => [url, url])),
      title: item.title,
      description: item.description,
      categoryIds: item.categoryIds,
      condition: item.condition,
      price: String(item.priceInr),
      location: item.location ? { ...item.location, area: item.area } : null,
    }),
  reset: () => set(initial),
}));

/**
 * The listing form lives in a store, not component state, so the draft survives opening the
 * "New category" sheet (another route) and accidental back-swipes. New and edit drafts are kept
 * apart so editing a listing never clobbers a half-written new one.
 */
export type ListingDraftStore = ReturnType<typeof createDraft>;

export const useListingDraft = createDraft();
export const useEditDraft = createDraft();
