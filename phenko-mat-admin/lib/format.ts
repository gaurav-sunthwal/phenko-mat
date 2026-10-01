const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export const formatDateTime = (iso: string | Date) => dateTime.format(new Date(iso));
export const formatDate = (iso: string | Date) => date.format(new Date(iso));
export const formatPrice = (inr: number) => (inr === 0 ? "Free" : `₹${inr.toLocaleString("en-IN")}`);

export function timeAgo(iso: string | Date) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(iso);
}

export const REASON_LABEL: Record<string, string> = {
  spam: "Spam / fake",
  scam: "Scam",
  prohibited: "Not allowed",
  offensive: "Offensive",
  other: "Other",
};
