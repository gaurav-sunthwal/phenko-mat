import { useLocalSearchParams } from "expo-router";
import { SheetScreen } from "@/components/ui";
import { ReportForm } from "@/features/safety/ReportForm";

/** `/report?kind=item|user&id=…&label=…` — form sheet. */
export default function ReportSheet() {
  const { kind, id, label = "" } = useLocalSearchParams<{ kind: "item" | "user"; id: string; label?: string }>();
  return (
    <SheetScreen title={kind === "item" ? "Report listing" : "Report person"}>
      <ReportForm kind={kind === "item" ? "item" : "user"} id={id} label={label} />
    </SheetScreen>
  );
}
