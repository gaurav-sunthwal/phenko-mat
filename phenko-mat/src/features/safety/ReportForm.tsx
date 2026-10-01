import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, FormError, Text, TextField } from "@/components/ui";
import { errorMessage } from "@/lib/api/errors";
import { colors, radius } from "@/theme";
import { REPORT_REASONS, sendReport, type ReportKind, type ReportReason } from "./api";

/** Report a listing or a person. Reports go to the team; the person isn't told who reported them. */
export function ReportForm({ kind, id, label }: { kind: ReportKind; id: string; label: string }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason) return setError("Pick a reason.");
    setState("sending");
    setError(null);
    try {
      await sendReport(kind, id, reason, details);
      setState("sent");
    } catch (e) {
      setError(errorMessage(e, "Couldn't send the report. Try again."));
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <View style={styles.done}>
        <Text size={40}>🙏</Text>
        <Text weight="bold" align="center">
          Thanks, we&apos;ll take a look.
        </Text>
        <Text size="sm" color={colors.inkSoft} align="center">
          {kind === "user"
            ? "If you don't want to hear from them again, you can also block them."
            : "We review every report and remove listings that break our guidelines."}
        </Text>
        <Button block label="Done" onPress={() => router.back()} style={styles.mt} />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text size="sm" color={colors.inkSoft}>
        What&apos;s wrong with {kind === "item" ? `“${label}”` : label.split(" ")[0]}?
      </Text>
      <View style={styles.reasons} accessibilityRole="radiogroup">
        {REPORT_REASONS.map((r) => {
          const on = reason === r.value;
          return (
            <Pressable
              key={r.value}
              onPress={() => setReason(r.value)}
              style={[styles.reason, on && styles.reasonOn]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <View style={[styles.dot, on && styles.dotOn]} />
              <Text weight="semibold">{r.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextField
        value={details}
        onChangeText={setDetails}
        maxLength={500}
        multiline
        placeholder="Anything else we should know? (optional)"
        accessibilityLabel="Details"
      />
      <FormError message={error} />
      <Button
        block
        label={state === "sending" ? "Sending…" : "Send report"}
        onPress={submit}
        disabled={state === "sending"}
        style={{ backgroundColor: colors.danger }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  reasons: { gap: 8 },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  reasonOn: { borderColor: colors.ink, backgroundColor: colors.cream },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.inkSoft },
  dotOn: { borderColor: colors.ink, borderWidth: 6 },
  done: { alignItems: "center", gap: 8 },
  mt: { marginTop: 12 },
});
