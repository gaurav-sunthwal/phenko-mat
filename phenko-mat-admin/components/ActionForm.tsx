"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/app/actions";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

const TONES = {
  danger: "bg-red-600 text-white hover:bg-red-700",
  primary: "bg-zinc-900 text-white hover:bg-black",
  secondary: "bg-white text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-50",
} as const;

/**
 * A form bound to a server action, with an optional confirm prompt, a pending state and the action's
 * result message. Hidden fields go in `fields`; extra inputs (reason, confirm text) in `children`.
 */
export function ActionForm({
  action,
  fields,
  label,
  pendingLabel = "Working…",
  confirm,
  tone = "secondary",
  children,
  className = "",
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  confirm?: string;
  tone?: keyof typeof TONES;
  children?: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={`flex flex-col gap-2 ${className}`}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <button disabled={pending} className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60 ${TONES[tone]}`}>
        {pending ? pendingLabel : label}
      </button>
      {state.error && (
        <p className="text-xs font-medium text-red-700" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="text-xs font-medium text-emerald-700" role="status">
          {state.ok}
        </p>
      )}
    </form>
  );
}

export const inputCls = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900";
