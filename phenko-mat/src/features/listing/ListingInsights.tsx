import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ErrorNote, Spinner, Text } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { errorMessage } from "@/lib/api/errors";
import type { ItemStats } from "@/shared/dto";
import { colors, radius } from "@/theme";
import { useItemStats } from "./api";

const REASON_LABEL: Record<keyof ItemStats["reports"]["byReason"], string> = {
  spam: "Spam",
  scam: "Scam",
  prohibited: "Not allowed",
  offensive: "Offensive",
  other: "Other",
};

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–");

/** The owner's numbers for one listing: who saw it, how they swiped, chats and reports. */
export function ListingInsights({ id }: { id: string }) {
  const { data: s, error, refetch } = useItemStats(id);
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  if (error) return <ErrorNote message={errorMessage(error)} onRetry={() => void refetch()} />;
  if (!s) return <Spinner />;

  const reasons = (Object.entries(s.reports.byReason) as [keyof typeof REASON_LABEL, number][]).sort((a, b) => b[1] - a[1]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.honeyDeep} />}
    >
      <View style={styles.grid}>
        <Tile emoji="👀" value={s.views} label={s.views === 1 ? "person saw it" : "people saw it"} wide />
        <Tile emoji="ⓘ" value={s.detailViews} label="opened details" note={percent(s.detailViews, s.views)} />
        <Tile emoji="💛" value={s.wanted} label="swiped right" note={percent(s.wanted, s.views)} tone={colors.honey} />
        <Tile emoji="👋" value={s.passed} label="passed" note={percent(s.passed, s.views)} />
        <Tile emoji="💬" value={s.chats} label={s.chats === 1 ? "chat" : "chats"} />
      </View>

      <View style={[styles.card, s.reports.total > 0 && styles.cardWarn]}>
        <Text weight="extrabold">
          {s.reports.total === 0 ? "No reports 🎉" : `${s.reports.total} ${s.reports.total === 1 ? "report" : "reports"}`}
        </Text>
        {s.reports.total === 0 ? (
          <Text size="sm" color={colors.inkSoft} style={styles.mt1}>
            Nobody has flagged this listing.
          </Text>
        ) : (
          <>
            <Text size="sm" color={colors.inkSoft} style={styles.mt1}>
              Reporters stay anonymous. Clear photos and an honest description help.
            </Text>
            {reasons.map(([reason, n]) => (
              <View key={reason} style={styles.reason}>
                <Text size="sm">{REASON_LABEL[reason] ?? reason}</Text>
                <Text weight="bold" size="sm">
                  {n}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>

      <Text size="xs" color={colors.inkSoft} align="center" style={styles.footnote}>
        Each person is counted once. Swipe percentages are out of everyone who saw it. Pull down to refresh.
      </Text>
    </ScrollView>
  );
}

function Tile({
  emoji,
  value,
  label,
  note,
  tone = colors.white,
  wide,
}: {
  emoji: string;
  value: number;
  label: string;
  note?: string;
  tone?: string;
  wide?: boolean;
}): ReactNode {
  return (
    <View style={[styles.cell, wide && styles.cellWide]}>
      <View style={[styles.tile, { backgroundColor: tone }]} accessible accessibilityLabel={`${value} ${label}${note ? `, ${note}` : ""}`}>
        <View style={styles.tileTop}>
          <Text size="lg">{emoji}</Text>
          {note ? (
            <Text weight="bold" size="xs" color={colors.inkSoft}>
              {note}
            </Text>
          ) : null}
        </View>
        <Text weight="black" size="3xl" style={styles.mt2}>
          {value}
        </Text>
        <Text weight="semibold" size="sm" color={colors.inkSoft}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  cell: { width: "50%", padding: 5 },
  cellWide: { width: "100%" },
  tile: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 16 },
  tileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  card: { marginTop: 10, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 16 },
  cardWarn: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  reason: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  mt1: { marginTop: 4 },
  mt2: { marginTop: 8 },
  footnote: { marginTop: 16, paddingHorizontal: 16 },
});
