import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeftIcon,
  Avatar,
  Button,
  CheckIcon,
  EmptyState,
  ErrorNote,
  IconButton,
  Photo,
  MoreIcon,
  PressableScale,
  SendIcon,
  Spinner,
  Text,
  TrashIcon,
} from "@/components/ui";
import { confirmDeleteConnection, useConnection, useDeleteConnection } from "@/features/connections/api";
import { useMarkGiven } from "@/features/profile/api";
import { useBlockUser } from "@/features/safety/api";
import { errorMessage } from "@/lib/api/errors";
import { sendTyping } from "@/lib/realtime/socket";
import type { ChatMessage, ConnectionSummary } from "@/shared/dto";
import { formatPrice } from "@/shared/format";
import { colors, fonts, radius, shadows } from "@/theme";
import { Bubble, TypingDots } from "./components/Bubble";
import { useChatStore, type PendingMessage } from "./store";
import { useChat } from "./useChat";

const TAKER_QUICK_REPLIES = ["Hi! Is this still available?", "When can I pick it up?", "Could you share more photos?"];
const GIVER_QUICK_REPLIES = ["Yes, it's still available!", "I'm free this evening.", "Where would suit you for pickup?"];

type Row = { kind: "message"; m: ChatMessage } | { kind: "pending"; p: PendingMessage };

interface ChatScreenProps {
  /** null while a just-matched chat is still being created on the server (see PendingChat). */
  id: string | null;
  /** Header data to show until the connection loads. */
  preview?: ConnectionSummary;
  /** Why creating the chat failed, if it did. */
  pendingError?: string | null;
}

export function ChatScreen({ id, preview, pendingError }: ChatScreenProps) {
  const insets = useSafeAreaInsets();
  const { data: connection, error: connError } = useConnection(id, preview);
  const { messages, pending, typing, liveReadAt, connected, send, retry, hasOlder, loadingOlder, loadOlder } = useChat(id);
  const block = useBlockUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const markItemGiven = useMarkGiven();
  const deleteChat = useDeleteConnection();
  // Set once this screen is on its way out, so a delete and its socket echo never pop twice.
  const leaving = useRef(false);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  // Messages written before the chat exists on the server; sent as soon as it does.
  const [outbox, setOutbox] = useState<PendingMessage[]>([]);

  const rows = useMemo<Row[]>(
    () => [
      ...(messages ?? []).map((m) => ({ kind: "message" as const, m })),
      // Once the id exists the outbox has been handed to `send`, whose own pending bubbles take over.
      ...[...pending, ...(id ? [] : outbox)].map((p) => ({ kind: "pending" as const, p })),
    ],
    [messages, pending, outbox, id],
  );

  function deliver(body: string) {
    // Optimistic: the bubble shows immediately; failures stay in place with a retry button.
    send(body).catch((e: unknown) => setSendError(errorMessage(e, "Message not sent. Tap it to retry.")));
  }

  // `id` only ever goes from null to the real id once, so this sends the outbox exactly once.
  useEffect(() => {
    if (id) outbox.forEach((p) => deliver(p.body));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush once, when the id arrives
  }, [id]);

  function submit(text: string) {
    const body = text.trim();
    if (!body) return;
    setDraft("");
    setSendError(null);
    if (id) return deliver(body);
    const createdAt = new Date().toISOString();
    setOutbox((o) => [...o, { clientId: `outbox-${createdAt}-${o.length}`, connectionId: "", body, status: "sending", createdAt }]);
  }

  // Asks who got it, then flips the header to "no longer available" optimistically (rolled back on failure).
  function markGiven() {
    if (connection) markItemGiven(connection.item.id);
  }

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/chats"));

  // Deleted live: by the other person → show that the chat has ended; by me (maybe on another device) → leave.
  const removedBy = useChatStore((s) => (id ? s.removed[id] : undefined));
  const otherId = connection?.other.id;
  const endedByOther = removedBy !== undefined && removedBy === otherId;
  useEffect(() => {
    if (removedBy === undefined || removedBy === otherId || leaving.current) return;
    leaving.current = true;
    if (router.canGoBack()) router.back();
    else router.replace("/chats");
  }, [removedBy, otherId]);

  function confirmDelete() {
    if (!id || !connection) return;
    confirmDeleteConnection(connection.other.name, () => {
      leaving.current = true;
      deleteChat.mutate(id);
      goBack();
    });
  }

  if (endedByOther) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <EmptyState
          emoji="👋"
          title="Chat ended"
          body={`${connection!.other.name.split(" ")[0]} removed this chat, so you're no longer connected.`}
          action={<Button label="Back to chats" onPress={goBack} />}
        />
      </View>
    );
  }

  if (connError || pendingError) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ErrorNote message={pendingError ?? errorMessage(connError)} />
      </View>
    );
  }
  if (!connection) return <Spinner />;

  const quickReplies = connection.role === "taker" ? TAKER_QUICK_REPLIES : GIVER_QUICK_REPLIES;
  const given = connection.item.status !== "active";
  const readUpTo = new Date(liveReadAt ?? connection.otherReadAt).getTime();
  const firstName = connection.other.name.split(" ")[0];

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={-insets.bottom} style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <IconButton icon={<ArrowLeftIcon size={20} />} size={36} background="transparent" accessibilityLabel="Back" onPress={goBack} />
        <Pressable
          onPress={() => router.push(`/user/${connection.other.id}`)}
          style={styles.person}
          accessibilityRole="button"
          accessibilityLabel={`View ${connection.other.name}'s profile`}
        >
          <Avatar user={connection.other} size={40} />
          <View style={styles.flex}>
            <Text weight="bold" numberOfLines={1}>
              {connection.other.name}
            </Text>
            <Text size="xs" weight={typing ? "semibold" : "regular"} color={typing ? colors.ink : colors.inkSoft} numberOfLines={1}>
              {typing ? "typing…" : connection.role === "giver" ? "Wants your item" : "Giving this away"}
            </Text>
          </View>
        </Pressable>
        {!id ? (
          <View style={[styles.reconnecting, styles.connecting]} accessibilityRole="text" accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.honeyDeep} />
            <Text weight="bold" size="xs1" color={colors.inkSoft}>
              Connecting…
            </Text>
          </View>
        ) : !connected ? (
          <View style={styles.reconnecting} accessibilityRole="text" accessibilityLiveRegion="polite">
            <Text weight="bold" size="xs1" color={colors.inkSoft}>
              Reconnecting…
            </Text>
          </View>
        ) : null}
        {id ? (
          <IconButton
            icon={<MoreIcon size={20} color={colors.inkSoft} />}
            size={36}
            background="transparent"
            accessibilityLabel="Chat options"
            onPress={() => setMenuOpen(true)}
          />
        ) : null}
      </View>

      <View style={styles.itemBar}>
        {/* Opens the listing (removed ones can't be opened any more). */}
        <Pressable
          onPress={() => router.push(`/listing/${connection.item.id}`)}
          disabled={connection.item.status === "removed"}
          style={styles.itemLink}
          accessibilityRole="button"
          accessibilityLabel={`View listing ${connection.item.title}`}
        >
          <View style={styles.itemPhoto}>
            <Photo uri={connection.item.photo} accessibilityLabel={connection.item.title} />
          </View>
          <View style={styles.flex}>
            <Text weight="bold" size="sm" numberOfLines={1}>
              {connection.item.title}
            </Text>
            <Text size="xs" color={colors.inkSoft}>
              {formatPrice(connection.item.priceInr)}
              {given ? " · no longer available" : " · view listing"}
            </Text>
          </View>
        </Pressable>
        {connection.role === "giver" && !given ? (
          <PressableScale onPress={markGiven} style={styles.givenButton} accessibilityLabel="Mark as given">
            <CheckIcon size={14} color={colors.white} />
            <Text weight="bold" size="xs" color={colors.white}>
              Mark as given
            </Text>
          </PressableScale>
        ) : null}
      </View>

      {!messages ? (
        <Spinner />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(r) => (r.kind === "message" ? `m${r.m.id}` : `p${r.p.clientId}`)}
          getItemType={(r) => r.kind}
          contentContainerStyle={styles.list}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }}
          ListHeaderComponent={
            hasOlder ? (
              <Pressable onPress={() => void loadOlder()} disabled={loadingOlder} style={styles.older} accessibilityRole="button">
                <Text weight="bold" size="xs" color={colors.inkSoft}>
                  {loadingOlder ? "Loading…" : "Load earlier messages"}
                </Text>
              </Pressable>
            ) : (
            <View style={styles.notice}>
              <Text size="xs" color={colors.inkSoft} align="center">
                You connected over{" "}
                <Text size="xs" weight="bold">
                  {connection.item.title}
                </Text>
                . Meet somewhere public and check the item before paying.
              </Text>
            </View>
            )
          }
          ListFooterComponent={typing ? <TypingDots name={firstName} /> : null}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          renderItem={({ item: r }) =>
            r.kind === "message" ? (
              <Bubble
                mine={r.m.mine}
                body={r.m.body}
                time={r.m.createdAt}
                status={r.m.mine ? (new Date(r.m.createdAt).getTime() <= readUpTo ? "read" : "sent") : undefined}
              />
            ) : (
              <View style={styles.pendingRow}>
                <Bubble mine body={r.p.body} time={r.p.createdAt} status={r.p.status === "failed" ? "failed" : "sending"} />
                {r.p.status === "failed" ? (
                  <Pressable onPress={() => retry(r.p.clientId)} accessibilityRole="button" hitSlop={6}>
                    <Text weight="bold" size="xs" color={colors.danger} style={styles.retry}>
                      Not sent · tap to retry
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )
          }
        />
      )}

      {messages?.length === 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickReplies} keyboardShouldPersistTaps="handled" style={styles.quickRepliesBar}>
          {quickReplies.map((q) => (
            <Pressable
              key={q}
              onPress={() => submit(q)}
              style={({ pressed }) => [styles.quickReply, pressed && { backgroundColor: colors.ink }]}
              accessibilityRole="button"
            >
              {({ pressed }) => (
                <Text weight="semibold" size="sm" color={pressed ? colors.white : colors.ink}>
                  {q}
                </Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {sendError ? (
        <Text size="sm" color={colors.danger} style={styles.sendError} accessibilityRole="alert">
          {sendError}
        </Text>
      ) : null}

      <View style={[styles.composer, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <TextInput
          value={draft}
          onChangeText={(v) => {
            setDraft(v);
            if (v.trim() && id) sendTyping(id);
          }}
          maxLength={2000}
          multiline
          placeholder="Write a message…"
          placeholderTextColor={colors.inkSoft}
          selectionColor={colors.honeyDeep}
          accessibilityLabel="Message"
          style={styles.input}
        />
        <PressableScale
          onPress={() => submit(draft)}
          disabled={!draft.trim()}
          style={[styles.send, !draft.trim() && styles.sendDisabled]}
          accessibilityLabel="Send"
        >
          <SendIcon size={20} />
        </PressableScale>
      </View>
      {menuOpen ? (
        <>
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu" />
          <View style={[styles.menu, { top: insets.top + 56 }]} accessibilityRole="menu">
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                router.push(`/user/${connection.other.id}`);
              }}
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.cream }]}
              accessibilityRole="menuitem"
            >
              <Text weight="semibold" size="sm">
                View {firstName}&apos;s profile
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                router.push({ pathname: "/report", params: { kind: "user", id: connection.other.id, label: connection.other.name } });
              }}
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.cream }]}
              accessibilityRole="menuitem"
            >
              <Text weight="semibold" size="sm">
                Report {firstName}
              </Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                setMenuOpen(false);
                if (await block(connection.other)) {
                  leaving.current = true;
                  goBack();
                }
              }}
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.dangerSoft }]}
              accessibilityRole="menuitem"
            >
              <Text weight="semibold" size="sm" color={colors.danger}>
                Block {firstName}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                confirmDelete();
              }}
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.cream }]}
              accessibilityRole="menuitem"
            >
              <TrashIcon size={15} color={colors.inkSoft} />
              <Text weight="semibold" size="sm" color={colors.inkSoft}>
                Delete chat
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1, minWidth: 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  reconnecting: { borderRadius: radius.full, backgroundColor: colors.cream, paddingHorizontal: 8, paddingVertical: 4 },
  connecting: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.cream,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  itemPhoto: { width: 48, height: 48, borderRadius: radius.md, overflow: "hidden" },
  itemLink: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  person: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  older: {
    alignSelf: "center",
    marginBottom: 16,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  menuBackdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 20 },
  menu: {
    position: "absolute",
    right: 12,
    zIndex: 21,
    width: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    paddingVertical: 4,
    ...shadows.xl,
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  givenButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.full,
    backgroundColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  list: { paddingHorizontal: 16, paddingVertical: 16 },
  notice: {
    alignSelf: "center",
    maxWidth: 320,
    marginBottom: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  gap: { height: 8 },
  pendingRow: { alignItems: "flex-end" },
  retry: { marginTop: 4, textDecorationLine: "underline" },
  quickRepliesBar: { flexGrow: 0 },
  quickReplies: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  quickReply: { borderWidth: 2, borderColor: colors.ink, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  sendError: { paddingHorizontal: 16, paddingBottom: 4 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  input: {
    flex: 1,
    maxHeight: 128,
    minHeight: 48,
    borderRadius: radius.tile,
    backgroundColor: colors.paper,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 13,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.honey, alignItems: "center", justifyContent: "center" },
  sendDisabled: { opacity: 0.4 },
});
