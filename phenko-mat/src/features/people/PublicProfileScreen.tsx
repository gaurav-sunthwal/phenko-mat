import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, EmptyState, ErrorNote, Photo, Spinner, Text } from "@/components/ui";
import { useMe } from "@/features/profile/api";
import { useBlockUser } from "@/features/safety/api";
import { BackTitle } from "@/features/shell/ScreenTitle";
import { isApiError, errorMessage } from "@/lib/api/errors";
import { formatPrice } from "@/shared/format";
import { alpha, colors, radius } from "@/theme";
import { usePublicProfile } from "./api";

const monthYear = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

/** Someone else's profile: who they are, how much they've given, their live listings (web: /u/[id]). */
export function PublicProfileScreen({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const { data: profile, error, refetch } = usePublicProfile(id);
  const block = useBlockUser();

  // Your own public profile is just your profile.
  useEffect(() => {
    if (me && me.id === id) router.replace("/profile");
  }, [me, id]);

  const header = <BackTitle title="" fallback="/feed" />;

  if (error) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        {header}
        {isApiError(error) && error.status === 404 ? (
          <EmptyState emoji="🫥" title="Profile not available" body="This person may have deleted their account." />
        ) : (
          <ErrorNote message={errorMessage(error)} onRetry={() => void refetch()} />
        )}
      </View>
    );
  }
  if (!profile) return <Spinner />;
  const first = profile.name.split(" ")[0];

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }}>
      {header}
      <View style={styles.card}>
        <View style={styles.row}>
          <Avatar user={profile} size={76} ring />
          <View style={styles.flex}>
            <Text weight="black" size="2xl" numberOfLines={1} accessibilityRole="header">
              {profile.name}
            </Text>
            <Text weight="semibold" size="sm">
              {profile.area ? `${profile.area} · ` : ""}Member since {monthYear.format(new Date(profile.memberSince))}
            </Text>
          </View>
        </View>
        {profile.bio ? (
          <Text size="sm" leading={1.5} style={styles.mt4}>
            {profile.bio}
          </Text>
        ) : null}
        <View style={styles.stats}>
          {(
            [
              ["Given away", profile.stats.given],
              ["Received", profile.stats.got],
            ] as const
          ).map(([label, value]) => (
            <View key={label} style={styles.stat}>
              <Text weight="black" size="xl">
                {value}
              </Text>
              <Text weight="semibold" size="xs">
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Text weight="extrabold" size="lg" style={styles.sectionTitle}>
        {profile.listings.length ? `${first}'s listings` : `${first} has nothing listed right now`}
      </Text>
      <View style={styles.grid}>
        {profile.listings.map((l) => (
          <View key={l.id} style={styles.cell}>
            <Pressable
              onPress={() => router.push(`/listing/${l.id}`)}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={l.title}
            >
              <View style={styles.tilePhoto}>
                <Photo uri={l.photo} accessibilityLabel={l.title} />
              </View>
              <View style={styles.tileBody}>
                <Text weight="bold" size="sm" numberOfLines={1}>
                  {l.title}
                </Text>
                <Text size="xs" color={colors.inkSoft}>
                  {formatPrice(l.priceInr)}
                </Text>
              </View>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push({ pathname: "/report", params: { kind: "user", id: profile.id, label: profile.name } })}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text weight="semibold" size="sm" color={colors.inkSoft} style={styles.underline}>
            Report {first}
          </Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            if (await block(profile)) router.replace("/feed");
          }}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text weight="semibold" size="sm" color={colors.danger} style={styles.underline}>
            Block {first}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  card: { marginHorizontal: 16, marginTop: 12, borderRadius: radius.sheet, backgroundColor: colors.honey, padding: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  flex: { flex: 1, minWidth: 0 },
  mt4: { marginTop: 16 },
  stats: { flexDirection: "row", gap: 8, marginTop: 20 },
  stat: { flex: 1, alignItems: "center", borderRadius: radius.lg, backgroundColor: alpha(colors.white, 0.6), paddingVertical: 10 },
  sectionTitle: { marginHorizontal: 16, marginTop: 32, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10 },
  cell: { width: "50%", padding: 6 },
  tile: { borderRadius: radius.card, backgroundColor: colors.white, overflow: "hidden" },
  pressed: { opacity: 0.85 },
  tilePhoto: { aspectRatio: 1 },
  tileBody: { padding: 12 },
  actions: { flexDirection: "row", justifyContent: "center", gap: 24, marginTop: 40 },
  underline: { textDecorationLine: "underline" },
});
