"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { ApiRequestError, api } from "@/lib/client/api";
import type { Category } from "@/lib/dto";
import { categoryCreateSchema } from "@/lib/validation";
import { Sheet } from "./ui";

const EMOJI_CHOICES = ["🏷️", "🌱", "🎮", "🎸", "📷", "🧰", "🐶", "💄", "🎨", "🧵", "🏕️", "🍼", "🖥️", "🚗", "⌚", "🎁"];

export function NewCategorySheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (c: Pick<Category, "id" | "name" | "emoji">) => void;
}) {
  const { mutate } = useSWRConfig();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = categoryCreateSchema.safeParse({ name, emoji });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setSaving(true);
    setError(null);
    try {
      const created = await api<Category>("POST", "/api/categories", parsed.data);
      await mutate("/api/categories");
      onCreated?.(created);
      setName("");
      onClose();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't create category.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="New category">
      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="e.g. Plants, Gaming, Stationery"
            className="w-full rounded-2xl border-2 border-line px-4 py-3 outline-none focus:border-honey"
          />
        </label>
        <fieldset>
          <legend className="mb-2 text-sm font-bold">Icon</legend>
          <div className="grid grid-cols-8 gap-2">
            {EMOJI_CHOICES.map((e) => (
              <button
                type="button"
                key={e}
                onClick={() => setEmoji(e)}
                aria-pressed={emoji === e}
                className={`flex aspect-square items-center justify-center rounded-xl text-xl transition ${
                  emoji === e ? "bg-honey" : "bg-paper hover:bg-cream"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </fieldset>
        {error && (
          <p className="text-sm font-medium text-[#B42318]" role="alert">
            {error}
          </p>
        )}
        <button
          disabled={saving}
          className="w-full rounded-full bg-ink px-5 py-3.5 font-bold text-white disabled:opacity-60"
        >
          {saving ? "Creating…" : "Create category"}
        </button>
      </form>
    </Sheet>
  );
}
