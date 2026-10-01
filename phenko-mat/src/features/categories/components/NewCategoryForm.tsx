import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, FormError, Text, TextField } from "@/components/ui";
import { errorMessage } from "@/lib/api/errors";
import type { Category } from "@/shared/dto";
import { categoryCreateSchema } from "@/shared/validation";
import { colors, radius } from "@/theme";
import { useCreateCategory } from "../api";

const EMOJI_CHOICES = ["🏷️", "🌱", "🎮", "🎸", "📷", "🧰", "🐶", "💄", "🎨", "🧵", "🏕️", "🍼", "🖥️", "🚗", "⌚", "🎁"];

export function NewCategoryForm({ onCreated }: { onCreated?: (c: Pick<Category, "id" | "name" | "emoji">) => void }) {
  const create = useCreateCategory();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const parsed = categoryCreateSchema.safeParse({ name, emoji });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);
    try {
      onCreated?.(await create.mutateAsync(parsed.data));
    } catch (e) {
      setError(errorMessage(e, "Couldn't create category."));
    }
  }

  return (
    <View style={styles.form}>
      <TextField
        label="Name"
        autoFocus
        value={name}
        onChangeText={setName}
        maxLength={40}
        placeholder="e.g. Plants, Gaming, Stationery"
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <View>
        <Text weight="bold" size="sm" style={styles.legend}>
          Icon
        </Text>
        <View style={styles.grid} accessibilityRole="radiogroup">
          {EMOJI_CHOICES.map((e) => (
            <Pressable
              key={e}
              onPress={() => setEmoji(e)}
              accessibilityRole="radio"
              accessibilityState={{ checked: emoji === e }}
              style={[styles.emoji, { backgroundColor: emoji === e ? colors.honey : colors.paper }]}
            >
              <Text size="xl">{e}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <FormError message={error} />
      <Button block label={create.isPending ? "Creating…" : "Create category"} onPress={submit} disabled={create.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 20 },
  legend: { marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emoji: {
    width: "10.5%",
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
