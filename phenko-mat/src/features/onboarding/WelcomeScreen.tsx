import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, CheckIcon, PressableScale, Spinner, Text } from "@/components/ui";
import { useCategories } from "@/features/categories/api";
import { LocationSetup } from "@/features/location/LocationForm";
import { useMe, useUpdateMe } from "@/features/profile/api";
import { useOnboarding } from "@/stores/onboarding";
import { colors, radius } from "@/theme";

/**
 * First run: asks what the person is looking for (saved as their interests, which rank the feed) and,
 * if missing, where they are. Shown once per account per device; either step can be skipped.
 */
export function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const { data: categories } = useCategories();
  const updateMe = useUpdateMe();
  const [picked, setPicked] = useState<string[]>([]);
  const [step, setStep] = useState<"interests" | "location">("interests");

  if (!me || !categories) return <Spinner />;
  const userId = me.id;
  const firstName = me.name.split(" ")[0];
  const options = categories.filter((c) => c.group !== "custom");

  function finish() {
    useOnboarding.getState().markSeen(userId);
    if (router.canGoBack()) router.back();
    else router.replace("/feed");
  }

  function next() {
    // Optimistic; the feed is invalidated and re-ranked as soon as it lands.
    if (picked.length) updateMe.mutate({ interests: picked });
    if (me?.location) finish();
    else setStep("location");
  }

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  if (step === "location") {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <SkipLink onPress={finish} />
        <LocationSetup onDone={finish} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <SkipLink onPress={finish} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text weight="black" size="3xl" accessibilityRole="header">
          Hi {firstName} 👋
        </Text>
        <Text weight="extrabold" size="xl" style={styles.mt2}>
          What are you looking for?
        </Text>
        <Text color={colors.inkSoft} style={styles.mt1}>
          Pick a few. Your feed will show these first, and you can change them anytime on your profile.
        </Text>
        <View style={styles.grid}>
          {options.map((c) => {
            const on = picked.includes(c.id);
            return (
              <View key={c.id} style={styles.cell}>
                <PressableScale
                  activeScale={0.96}
                  onPress={() => toggle(c.id)}
                  style={StyleSheet.flatten([styles.tile, on && styles.tileOn])}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={c.name}
                >
                  {on ? (
                    <View style={styles.check}>
                      <CheckIcon size={12} color={colors.white} strokeWidth={3} />
                    </View>
                  ) : null}
                  <Text size={30}>{c.emoji}</Text>
                  <Text weight="bold" size="sm" align="center" numberOfLines={2}>
                    {c.name}
                  </Text>
                </PressableScale>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          block
          size="lg"
          weight="extrabold"
          label={picked.length ? `Continue with ${picked.length}` : "Pick at least one"}
          disabled={!picked.length}
          onPress={next}
        />
      </View>
    </View>
  );
}

function SkipLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.skip} hitSlop={10} accessibilityRole="button">
      <Text weight="semibold" size="sm" color={colors.inkSoft}>
        Skip
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  mt1: { marginTop: 4 },
  mt2: { marginTop: 8 },
  skip: { alignSelf: "flex-end", paddingHorizontal: 20, paddingVertical: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5, marginTop: 20 },
  cell: { width: "33.333%", padding: 5 },
  tile: {
    aspectRatio: 1,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 8,
  },
  tileOn: { borderColor: colors.ink, backgroundColor: colors.honey },
  check: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper },
});
