"use client";

import { useState } from "react";
import { ApiRequestError } from "@/lib/client/api";
import { REPORT_REASONS, sendReport, type ReportReason, type ReportTarget } from "@/lib/client/safety";
import { Sheet } from "./ui";

/** Report a listing or a person. Reports go to the team; the person isn't told who reported them. */
export function ReportSheet({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  return (
    <Sheet open={target !== null} onClose={onClose} title={target?.kind === "item" ? "Report listing" : "Report person"}>
      {target && <ReportForm key={`${target.kind}:${target.id}`} target={target} onDone={onClose} />}
    </Sheet>
  );
}

function ReportForm({ target, onDone }: { target: ReportTarget; onDone: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return setError("Pick a reason.");
    setState("sending");
    setError(null);
    try {
      await sendReport(target, reason, details);
      setState("sent");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't send the report. Try again.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-4xl" aria-hidden="true">
          🙏
        </p>
        <p className="font-bold">Thanks, we&apos;ll take a look.</p>
        <p className="text-sm text-ink-soft">
          {target.kind === "user"
            ? "If you don't want to hear from them again, you can also block them."
            : "We review every report and remove listings that break our guidelines."}
        </p>
        <button onClick={onDone} className="w-full rounded-full bg-ink px-5 py-3.5 font-bold text-white">
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-ink-soft">
        What&apos;s wrong with {target.kind === "item" ? `“${target.title}”` : target.name.split(" ")[0]}?
      </p>
      <fieldset className="space-y-2">
        <legend className="sr-only">Reason</legend>
        {REPORT_REASONS.map((r) => (
          <label
            key={r.value}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 font-semibold transition ${
              reason === r.value ? "border-ink bg-cream" : "border-line hover:border-ink"
            }`}
          >
            <input
              type="radio"
              name="reason"
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
              className="accent-ink"
            />
            {r.label}
          </label>
        ))}
      </fieldset>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Anything else we should know? (optional)"
        aria-label="Details"
        className="w-full resize-none rounded-2xl border-2 border-line px-4 py-3 outline-none focus:border-honey"
      />
      {error && (
        <p className="text-sm font-medium text-[#B42318]" role="alert">
          {error}
        </p>
      )}
      <button
        disabled={state === "sending"}
        className="w-full rounded-full bg-[#B42318] px-5 py-3.5 font-bold text-white disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Send report"}
      </button>
    </form>
  );
}
