import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, CameraIcon, Chip, FormError, Photo, PinIcon, PlusIcon, SegmentedControl, Spinner, Text, TextField, XIcon } from "@/components/ui";
import { useCategories } from "@/features/categories/api";
import { LocationSetup } from "@/features/location/LocationForm";
import { useMe } from "@/features/profile/api";
import { BackTitle } from "@/features/shell/ScreenTitle";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { uploadImage } from "@/lib/api/upload";
import { qk } from "@/lib/query/keys";
import { CONDITION_LABEL } from "@/shared/format";
import { CONDITIONS, itemCreateSchema } from "@/shared/validation";
import type { FeedItem } from "@/shared/dto";
import { alpha, colors, radius } from "@/theme";
import { MAX_PHOTOS, useEditDraft, useListingDraft, type ListingDraftStore } from "./draft";

const CONDITION_OPTIONS = CONDITIONS.map((c) => ({ value: c, label: CONDITION_LABEL[c] }));

export function NewItemForm() {
  return <ListingForm store={useListingDraft} />;
}

/** Editing an existing listing. The caller loads it into `useEditDraft` first. */
export function EditItemForm({ item }: { item: FeedItem }) {
  return <ListingForm store={useEditDraft} editing={item} />;
}

function ListingForm({ store, editing }: { store: ListingDraftStore; editing?: FeedItem }) {
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const { data: me, isLoading: meLoading } = useMe();
  const { data: categories } = useCategories();
  const draft = store();
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "publishing">("idle");

  if (meLoading) return <Spinner />;
  if (!editing && me && !me.location) return <LocationSetup />;

  const slotsLeft = MAX_PHOTOS - draft.photos.length;
  const busy = phase !== "idle";

  async function pick(source: "camera" | "library") {
    const perm =
      source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setPhotoError(`Allow ${source === "camera" ? "camera" : "photo"} access to add pictures.`);
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsMultipleSelection: true,
            selectionLimit: slotsLeft,
            orderedSelection: true,
            quality: 1,
          });
    if (result.canceled) return;
    setPhotoError(null);
    draft.addPhotos(result.assets.map(({ uri, width, height }) => ({ uri, width, height })));
  }

  /** Uploads photos not yet uploaded (a retried publish skips the ones that already made it). */
  async function uploadPhotos() {
    const { photos, uploaded, markUploaded } = store.getState();
    return Promise.all(
      photos.map(async (photo) => {
        const existing = uploaded[photo.uri];
        if (existing) return existing;
        const url = await uploadImage(photo);
        markUploaded(photo.uri, url);
        return url;
      }),
    );
  }

  function addPhotos() {
    Alert.alert("Add photos", undefined, [
      { text: "Take photo", onPress: () => void pick("camera") },
      { text: "Choose from library", onPress: () => void pick("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function submit() {
    // Check everything cheap first, so nothing is uploaded for a form that can't be published.
    const fields = itemCreateSchema.omit({ photos: true }).safeParse({
      title: draft.title,
      description: draft.description,
      categoryIds: draft.categoryIds,
      condition: draft.condition,
      priceInr: Number(draft.price),
      location: draft.location ?? undefined,
    });
    if (!draft.photos.length) return setError("Add at least one photo.");
    if (!fields.success) return setError(fields.error.issues[0].message);
    if (!(Number(draft.price) >= 1)) return setError("Enter a price — ₹1 is fine.");

    setError(null);
    setPhotoError(null);
    setPhase("uploading");
    let photos: string[];
    try {
      photos = await uploadPhotos();
    } catch (e) {
      console.warn("[upload] photo failed", e);
      setError(errorMessage(e, "A photo failed to upload. Check your connection and try again."));
      return setPhase("idle");
    }

    setPhase("publishing");
    try {
      if (editing) {
        await api.patch(`/api/items/${editing.id}`, { ...fields.data, photos });
        // Title and cover photo also show in chats; the preview refetches the item.
        void client.invalidateQueries({ queryKey: qk.item(editing.id) });
        void client.invalidateQueries({ queryKey: qk.myItems });
        void client.invalidateQueries({ queryKey: qk.connections.all });
        void client.invalidateQueries({ queryKey: qk.feed.all });
        store.getState().reset();
        router.back();
      } else {
        await api.post("/api/items", { ...fields.data, photos });
        // Refresh in the background; the profile shows its cached list until the new one arrives.
        void client.invalidateQueries({ queryKey: qk.myItems });
        void client.invalidateQueries({ queryKey: qk.me });
        store.getState().reset();
        router.replace("/profile");
      }
    } catch (e) {
      setError(errorMessage(e, editing ? "Couldn't save. Try again." : "Couldn't publish. Try again."));
      setPhase("idle");
    }
  }

  // The listing's own spot if one was picked, else (new listings) the owner's profile area.
  const place = draft.location ?? (me?.location && me.area ? { ...me.location, area: me.area } : null);
  const fallback: Href = editing ? `/listing/${editing.id}` : "/feed";
  const idleLabel = editing ? "Save changes" : "Publish listing";
  const busyLabel = editing ? "Saving…" : "Publishing…";


  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <BackTitle title={editing ? "Edit listing" : "List something"} fallback={fallback} accessibilityLabel="Cancel" />

      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <View>
          <Text weight="extrabold" style={styles.mb1}>
            Photos
          </Text>
          <Text size="sm" color={colors.inkSoft} style={styles.mb3}>
            Good light, plain background. The first photo is the cover.
          </Text>
          <View style={styles.photoGrid}>
            {draft.photos.map((photo, i) => (
              <View key={photo.uri} style={styles.photoCell}>
                <View style={styles.photo}>
                  <Photo uri={photo.uri} transition={0} accessibilityLabel={`Photo ${i + 1}`} />
                  {i === 0 ? (
                    <View style={styles.cover}>
                      <Text weight="extrabold" size="xs2">
                        COVER
                      </Text>
                    </View>
                  ) : null}
                  {busy ? null : (
                    <Pressable
                      onPress={() => draft.removePhoto(photo.uri)}
                      style={styles.removePhoto}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${i + 1}`}
                      hitSlop={6}
                    >
                      <XIcon size={14} color={colors.white} />
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
            {slotsLeft > 0 && !busy ? (
              <View style={styles.photoCell}>
                <Pressable
                  onPress={addPhotos}
                  style={({ pressed }) => [styles.photo, styles.addPhoto, pressed && { borderColor: colors.honey }]}
                  accessibilityRole="button"
                  accessibilityLabel="Add photos"
                >
                  <CameraIcon size={26} color={colors.inkSoft} />
                  <Text weight="bold" size="sm" color={colors.inkSoft}>
                    Add
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          <FormError message={photoError} />
        </View>

        <TextField
          label="What is it?"
          labelWeight="extrabold"
          value={draft.title}
          onChangeText={(title) => draft.set({ title })}
          maxLength={80}
          placeholder="e.g. Blue denim jacket, size M"
          returnKeyType="next"
        />

        <TextField
          label="Details"
          labelWeight="extrabold"
          value={draft.description}
          onChangeText={(description) => draft.set({ description })}
          maxLength={1000}
          multiline
          placeholder="Size, age, any wear and tear, why you're giving it away…"
        />

        <View>
          <Text weight="extrabold" style={styles.mb1}>
            Categories
          </Text>
          <Text size="sm" color={colors.inkSoft} style={styles.mb3}>
            Pick up to 5, e.g. “Clothing” + “Premium”.
          </Text>
          <View style={styles.chips}>
            {categories?.map((c) => (
              <Chip
                key={c.id}
                tone="ink"
                label={c.name}
                emoji={c.emoji}
                selected={draft.categoryIds.includes(c.id)}
                onPress={() => draft.toggleCategory(c.id)}
              />
            ))}
            <Chip
              tone="dashed"
              label="New"
              leading={<PlusIcon size={16} color={colors.inkSoft} />}
              onPress={() => router.push({ pathname: "/new-category", params: { for: editing ? "edit" : "listing" } })}
            />
          </View>
        </View>

        <View>
          <Text weight="extrabold" style={styles.mb3}>
            Condition
          </Text>
          <SegmentedControl options={CONDITION_OPTIONS} value={draft.condition} onChange={(condition) => draft.set({ condition })} activeTone="honey" />
        </View>

        <View>
          <Text weight="extrabold">Price</Text>
          <Text size="sm" color={colors.inkSoft} style={styles.mb3}>
            Anything from ₹1. Paid to you directly at pickup.
          </Text>
          <TextField
            prefix={
              <Text weight="bold" color={colors.inkSoft}>
                ₹
              </Text>
            }
            value={draft.price}
            onChangeText={(v) => draft.set({ price: v.replace(/\D/g, "").replace(/^0+/, "").slice(0, 8) })}
            keyboardType="number-pad"
            placeholder="1"
            accessibilityLabel="Price in rupees"
            style={styles.priceInput}
          />
        </View>

        <View style={styles.areaNote}>
          <PinIcon size={20} />
          <View style={styles.areaText}>
            {place ? (
              <Text size="sm">
                Pickup near <Text weight="bold" size="sm">{place.area}</Text>
                {draft.location ? null : <Text size="sm" color={colors.inkSoft}> (your area)</Text>}
              </Text>
            ) : (
              <Text size="sm">Choose where it can be picked up</Text>
            )}
            <Text size="xs" color={colors.inkSoft}>
              People see the area and distance, never the exact spot.
            </Text>
          </View>
          <Button
            size="sm"
            variant="white"
            label={place ? "Change" : "Choose"}
            onPress={() => router.push({ pathname: "/listing-location", params: { for: editing ? "edit" : "listing" } })}
          />
        </View>

        <FormError message={error} />

        <Button
          block
          size="lg"
          weight="extrabold"
          label={phase === "uploading" ? "Uploading photos…" : phase === "publishing" ? busyLabel : idleLabel}
          onPress={submit}
          disabled={busy}
        />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 28 },
  mb1: { marginBottom: 4 },
  mb3: { marginBottom: 12 },
  mt3: { marginTop: 12 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  photoCell: { width: "33.333%", padding: 4 },
  photo: { aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: "hidden" },
  cover: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: colors.honey,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  removePhoto: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: alpha(colors.ink, 0.7),
    alignItems: "center",
    justifyContent: "center",
  },
  addPhoto: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  priceInput: { paddingHorizontal: 8 },
  areaNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.cream,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  areaText: { flex: 1, minWidth: 0 },
});
