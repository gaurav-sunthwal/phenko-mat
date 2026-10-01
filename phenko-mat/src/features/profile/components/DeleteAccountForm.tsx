import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, FormError, Text, TextField } from "@/components/ui";
import { deleteAccount } from "@/features/auth/session";
import { errorMessage } from "@/lib/api/errors";
import { colors } from "@/theme";

/** Web used `prompt('Type "DELETE"')`; native gets a proper confirmation sheet. */
export function DeleteAccountForm() {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(); // signs out → the route guard leaves this screen
    } catch (e) {
      setError(errorMessage(e, "Couldn't delete account."));
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text leading={1.5}>
        This permanently deletes your account, listings and chats. Type <Text weight="bold">DELETE</Text> to confirm.
      </Text>
      <TextField value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} placeholder="DELETE" accessibilityLabel="Type DELETE to confirm" />
      <FormError message={error} />
      <Button
        block
        label={busy ? "Deleting…" : "Delete my account"}
        onPress={confirm}
        disabled={busy || typed.trim() !== "DELETE"}
        style={{ backgroundColor: colors.danger }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
});
