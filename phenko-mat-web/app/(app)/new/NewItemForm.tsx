"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { ArrowLeftIcon, CameraIcon, PlusIcon, XIcon } from "@/components/icons";
import { ListingLocationPicker } from "@/components/ListingLocationPicker";
import { LocationSetup } from "@/components/LocationSetup";
import { NewCategorySheet } from "@/components/NewCategorySheet";
import { Photo, Spinner } from "@/components/ui";
import { ApiRequestError, api, uploadImage } from "@/lib/client/api";
import { useCategories, useMe } from "@/lib/client/hooks";
import { MAX_PHOTOS, useEditDraft, useListingDraft, type ListingDraftStore } from "@/lib/client/stores/listingDraft";
import type { FeedItem } from "@/lib/dto";
import { CONDITION_LABEL } from "@/lib/format";
import { CONDITIONS, itemCreateSchema } from "@/lib/validation";

export function NewItemForm() {
  return <ListingForm store={useListingDraft} />;
}

/** Editing an existing listing. The caller loads it into `useEditDraft` first. */
export function EditItemForm({ item }: { item: FeedItem }) {
  return <ListingForm store={useEditDraft} editing={item} />;
}

function ListingForm({ store, editing }: { store: ListingDraftStore; editing?: FeedItem }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: me, isLoading: meLoading } = useMe();
  const { data: categories } = useCategories();

  // The draft lives in a store, so leaving the page (or opening "New category") keeps it.
  const draft = store();
  const { photos, title, description, categoryIds, condition, price, location } = draft;
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "publishing">("idle");
  const busy = phase !== "idle";

  if (meLoading) return <Spinner />;
  if (!editing && me && !me.location) return <LocationSetup />;

  const setTitle = (title: string) => draft.set({ title });
  const setDescription = (description: string) => draft.set({ description });
  const setCondition = (condition: (typeof CONDITIONS)[number]) => draft.set({ condition });
  const setPrice = (price: string) => draft.set({ price });
  const toggleCategory = draft.toggleCategory;
  const profilePlace = me?.location && me.area ? { ...me.location, area: me.area } : null;
  const backHref = editing ? `/listing/${editing.id}` : "/feed";

  function addPhotos(files: FileList | null) {
    if (!files) return;
    setError(null);
    draft.addFiles(Array.from(files));
  }

  /** Uploads photos not yet uploaded (a retried publish skips the ones that already made it). */
  function uploadPhotos() {
    const { photos, uploaded, markUploaded } = store.getState();
    return Promise.all(
      photos.map(async ({ preview, file }) => {
        const existing = uploaded[preview];
        if (existing) return existing;
        if (!file) throw new Error("Missing photo file");
        const url = await uploadImage(file);
        markUploaded(preview, url);
        return url;
      }),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Check everything cheap first, so nothing is uploaded for a form that can't be published.
    const fields = itemCreateSchema.omit({ photos: true }).safeParse({
      title,
      description,
      categoryIds,
      condition,
      priceInr: Number(price),
      location: location ?? undefined,
    });
    if (!photos.length) return setError("Add at least one photo.");
    if (!fields.success) return setError(fields.error.issues[0].message);
    if (!(Number(price) >= 1)) return setError("Enter a price — ₹1 is fine.");

    setError(null);
    setPhase("uploading");
    let urls: string[];
    try {
      urls = await uploadPhotos();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "A photo failed to upload. Check your connection and try again.");
      return setPhase("idle");
    }

    setPhase("publishing");
    try {
      if (editing) {
        await api("PATCH", `/api/items/${editing.id}`, { ...fields.data, photos: urls });
        // Title and cover photo also show in chats and the feed.
        await mutate(`/api/items/${editing.id}`);
        mutate("/api/me/items");
        mutate((key) => typeof key === "string" && (key.startsWith("/api/connections") || key.startsWith("/api/feed")));
        store.getState().reset();
        router.replace(`/listing/${editing.id}`);
      } else {
        await api("POST", "/api/items", { ...fields.data, photos: urls });
        await Promise.all([mutate("/api/me/items"), mutate("/api/me")]);
        store.getState().reset();
        // Replace, not push: Back from the profile shouldn't land on an emptied form.
        router.replace("/profile");
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : editing ? "Couldn't save. Try again." : "Couldn't publish. Try again.");
      setPhase("idle");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-paper/90 px-4 py-3 backdrop-blur-md md:mx-auto md:w-full md:max-w-5xl md:px-8 md:pt-8 md:pb-4">
        <Link href={backHref} className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm" aria-label="Cancel">
          <ArrowLeftIcon size={18} />
        </Link>
        <h1 className="text-xl font-extrabold md:text-3xl md:font-black">{editing ? "Edit listing" : "List something"}</h1>
      </header>

      {/* lg and up: photos on the left (sticky), details on the right. */}
      <form
        onSubmit={submit}
        className="flex-1 space-y-7 px-4 pt-2 pb-10 md:mx-auto md:w-full md:max-w-5xl md:px-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10 lg:space-y-0"
      >
        <section className="lg:sticky lg:top-24 lg:rounded-[28px] lg:bg-white lg:p-6">
          <h2 className="mb-1 font-extrabold">Photos</h2>
          <p className="mb-3 text-sm text-ink-soft">Good light, plain background. The first photo is the cover.</p>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, i) => (
              <div key={photo.preview} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-cream">
                <Photo src={photo.preview} alt={`Photo ${i + 1}`} sizes="160px" />
                {i === 0 && (
                  <span className="absolute bottom-1.5 left-1.5 rounded-full bg-honey px-2 py-0.5 text-[10px] font-extrabold">
                    COVER
                  </span>
                )}
                {!busy && (
                  <button
                    type="button"
                    onClick={() => draft.removePhoto(photo.preview)}
                    className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-white"
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>
            ))}
            {photos.length < MAX_PHOTOS && !busy && (
              // Like the app's "Take photo / Choose from library": on phones the camera opens directly.
              <div className="flex aspect-[3/4] flex-col overflow-hidden rounded-2xl border-2 border-dashed border-line bg-white text-sm font-bold text-ink-soft">
                <label className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 transition hover:bg-cream hover:text-ink">
                  <CameraIcon size={24} />
                  Take photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => {
                      addPhotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 border-t-2 border-dashed border-line transition hover:bg-cream hover:text-ink">
                  <PlusIcon size={22} />
                  Choose photos
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      addPhotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        </section>

        <div className="space-y-7">
          <label className="block">
            <span className="mb-1.5 block font-extrabold">What is it?</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="e.g. Blue denim jacket, size M"
              className="w-full rounded-2xl border-2 border-line bg-white px-4 py-3 outline-none focus:border-honey"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block font-extrabold">Details</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Size, age, any wear and tear, why you're giving it away…"
              className="w-full resize-none rounded-2xl border-2 border-line bg-white px-4 py-3 outline-none focus:border-honey"
            />
          </label>

          <section>
            <h2 className="mb-1 font-extrabold">Categories</h2>
            <p className="mb-3 text-sm text-ink-soft">Pick up to 5, e.g. “Clothing” + “Premium”.</p>
            <div className="flex flex-wrap gap-2">
              {categories?.map((c) => {
                const on = categoryIds.includes(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggleCategory(c.id)}
                    aria-pressed={on}
                    className={`rounded-full border-2 px-3.5 py-2 text-sm font-semibold transition ${
                      on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"
                    }`}
                  >
                    <span aria-hidden="true">{c.emoji}</span> {c.name}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCreatingCategory(true)}
                className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-line px-3.5 py-2 text-sm font-semibold text-ink-soft hover:border-ink hover:text-ink"
              >
                <PlusIcon size={16} /> New
              </button>
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-extrabold">Condition</h2>
            <div className="grid grid-cols-4 gap-1 rounded-full bg-white p-1">
              {CONDITIONS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCondition(c)}
                  aria-pressed={condition === c}
                  className={`rounded-full py-2 text-sm font-bold transition ${condition === c ? "bg-honey" : "text-ink-soft"}`}
                >
                  {CONDITION_LABEL[c]}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-1 font-extrabold">Price</h2>
            <p className="mb-3 text-sm text-ink-soft">Anything from ₹1. Paid to you directly at pickup.</p>
            <label className="flex items-center rounded-2xl border-2 border-line bg-white px-4 focus-within:border-honey">
              <span className="font-bold text-ink-soft">₹</span>
              <input
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 8))}
                placeholder="1"
                aria-label="Price in rupees"
                className="w-full bg-transparent px-2 py-3 outline-none"
              />
            </label>
          </section>

          <ListingLocationPicker
            value={location}
            fallback={profilePlace}
            // Editing: "use my area" has to be sent explicitly — null would just mean "unchanged".
            onChange={(next) => draft.set({ location: next ?? (editing ? profilePlace : null) })}
          />

          {error && (
            <p className="text-sm font-semibold text-[#B42318]" role="alert">
              {error}
            </p>
          )}

          <button
            disabled={busy}
            className="w-full rounded-full bg-ink px-6 py-4 text-lg font-extrabold text-white transition hover:bg-black disabled:opacity-50"
          >
            {phase === "uploading"
              ? "Uploading photos…"
              : phase === "publishing"
                ? editing
                  ? "Saving…"
                  : "Publishing…"
                : editing
                  ? "Save changes"
                  : "Publish listing"}
          </button>
        </div>
      </form>

      <NewCategorySheet
        open={creatingCategory}
        onClose={() => setCreatingCategory(false)}
        onCreated={(c) => draft.addCategory(c.id)}
      />
    </div>
  );
}
