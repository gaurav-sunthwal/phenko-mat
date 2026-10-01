import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Avatar, Button, CameraIcon, FormError, Text, TextField } from "@/components/ui";
import { errorMessage } from "@/lib/api/errors";
import { uploadImage, type PickedImage } from "@/lib/api/upload";
import type { Me } from "@/shared/dto";
import { colors } from "@/theme";
import { useUpdateMe } from "../api";

export function EditProfileForm({ me, onDone }: { me: Me; onDone: () => void }) {
  const updateMe = useUpdateMe();
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio);
  /** Picked but not yet uploaded — the upload happens on Save, so abandoned picks cost nothing. */
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError("Allow photo access to change your picture.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (result.canceled) return;
    const { uri, width, height } = result.assets[0];
    setPicked({ uri, width, height });
    setError(null);
  }

  async function save() {
    setError(null);
    let avatarUrl: string | undefined;
    if (picked) {
      setUploading(true);
      try {
        avatarUrl = await uploadImage(picked);
      } catch (e) {
        console.warn("[upload] avatar failed", e);
        return setError(errorMessage(e, "Photo upload failed. Try again."));
      } finally {
        setUploading(false);
      }
    }
    try {
      await updateMe.mutateAsync({ name, bio, ...(avatarUrl && { avatarUrl }) });
      onDone();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save."));
    }
  }

  const busy = uploading || updateMe.isPending;

  return (
    <View style={styles.form}>
      <Pressable onPress={pickAvatar} disabled={busy} style={styles.avatarPicker} accessibilityRole="button" accessibilityLabel="Change photo">
        <View>
          <Avatar user={{ name, avatarUrl: picked?.uri ?? me.avatarUrl }} size={96} />
          <View style={styles.camera}>
            {uploading ? <ActivityIndicator size="small" color={colors.white} /> : <CameraIcon size={16} color={colors.white} />}
          </View>
        </View>
        <Text weight="bold" size="sm">
          Change photo
        </Text>
      </Pressable>
      <TextField label="Name" value={name} onChangeText={setName} maxLength={60} autoCapitalize="words" />
      <TextField
        label="About you"
        value={bio}
        onChangeText={setBio}
        maxLength={300}
        multiline
        placeholder="Decluttering, moving, or just love passing things on?"
      />
      <FormError message={error} />
      <Button block label={uploading ? "Uploading photo…" : updateMe.isPending ? "Saving…" : "Save"} onPress={save} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  avatarPicker: { alignSelf: "center", alignItems: "center", gap: 8 },
  camera: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
});
