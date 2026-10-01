import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Button, EmptyState, ErrorNote, SegmentedControl, Spinner, Text } from "@/components/ui";
import { signOut } from "@/features/auth/session";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { errorMessage } from "@/lib/api/errors";
import type { LikedItem, MyItem } from "@/shared/dto";
import { colors } from "@/theme";
import { useLikes, useMe, useMyItems } from "./api";
import { AccountLinks } from "./components/AccountLinks";
import { Interests } from "./components/Interests";
import { LikedTile } from "./components/LikedTile";
import { ListingRow } from "./components/ListingRow";
import { ProfileHeader } from "./components/ProfileHeader";

type Tab = "listings" | "wanted";

export function ProfileScreen() {
  const me = useMe();
  const myItems = useMyItems();
  const likes = useLikes();
  const [tab, setTab] = useState<Tab>("listings");
  const { refreshing, onRefresh: refresh } = usePullToRefresh(() =>
    Promise.all([me.refetch(), (tab === "listings" ? myItems : likes).refetch()]),
  );

  if (me.error) return <ErrorNote message={errorMessage(me.error)} onRetry={() => void me.refetch()} />;
  if (!me.data) return <Spinner />;

  const active = tab === "listings" ? myItems : likes;
  const tabs = [
    { value: "listings", label: "My listings", count: myItems.data?.length },
    { value: "wanted", label: "Things I want", count: likes.data?.length },
  ] as const;

  const header = (
    <View>
      <ProfileHeader me={me.data} />
      <Interests me={me.data} />
      <SegmentedControl options={tabs} value={tab} onChange={setTab} style={styles.tabs} />
    </View>
  );

  let empty;
  if (active.error) empty = <ErrorNote message={errorMessage(active.error)} onRetry={() => void active.refetch()} />;
  else if (!active.data) empty = <Spinner />;
  else if (tab === "listings") {
    empty = (
      <EmptyState
        emoji="📦"
        title="Nothing listed yet"
        body="Got something you don't use anymore? Someone nearby probably needs it."
        action={<Button label="List your first item" onPress={() => router.push("/new")} />}
      />
    );
  } else {
    empty = (
      <EmptyState
        emoji="💛"
        title="No likes yet"
        body="Items you swipe right on show up here."
        action={<Button label="Start swiping" onPress={() => router.navigate("/feed")} />}
      />
    );
  }

  const common = {
    ListHeaderComponent: header,
    ListEmptyComponent: empty,
    ListFooterComponent: <AccountActions />,
    contentContainerStyle: styles.content,
    refreshControl: <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.honeyDeep} />,
  };

  // Separate lists (keyed) so each tab keeps its own layout and recycling pool.
  return tab === "listings" ? (
    <FlashList<MyItem>
      key="listings"
      {...common}
      data={myItems.data ?? []}
      keyExtractor={(i) => i.id}
      ItemSeparatorComponent={Separator}
      renderItem={({ item, index }) => <View style={index === 0 && styles.firstRow}><ListingRow item={item} /></View>}
    />
  ) : (
    <FlashList<LikedItem>
      key="wanted"
      {...common}
      data={likes.data ?? []}
      numColumns={2}
      keyExtractor={(l) => l.connectionId}
      renderItem={({ item, index }) => (
        <View style={[styles.gridCell, index % 2 === 0 ? styles.gridLeft : styles.gridRight, index < 2 && styles.firstRow]}>
          <LikedTile like={item} />
        </View>
      )}
    />
  );
}

const Separator = () => <View style={styles.separator} />;

function AccountActions() {
  const [busy, setBusy] = useState(false);
  return (
    <View style={styles.account}>
      <AccountLinks />
      <Button
        block
        variant="outline"
        label="Sign out"
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          await signOut();
        }}
      />
      <Pressable onPress={() => router.push("/delete-account")} disabled={busy} accessibilityRole="button" hitSlop={8}>
        <Text weight="semibold" size="sm" color={colors.danger} style={styles.underline}>
          Delete my account
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  tabs: { marginHorizontal: 16, marginTop: 32 },
  firstRow: { paddingTop: 16 },
  separator: { height: 12 },
  gridCell: { paddingBottom: 12 },
  gridLeft: { paddingLeft: 16, paddingRight: 6 },
  gridRight: { paddingLeft: 6, paddingRight: 16 },
  account: { marginTop: 40, paddingHorizontal: 16, alignItems: "center", gap: 12 },
  underline: { textDecorationLine: "underline" },
});
