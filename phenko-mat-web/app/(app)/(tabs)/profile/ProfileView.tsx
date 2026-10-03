"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useSWRConfig } from "swr";
import { CameraIcon, CheckIcon, PencilIcon, PinIcon, TrashIcon } from "@/components/icons";
import { LocationForm } from "@/components/LocationSetup";
import { Avatar, EmptyState, ErrorNote, Photo, Sheet, Spinner } from "@/components/ui";
import { ApiRequestError, api, uploadImage } from "@/lib/client/api";
import { useBlocked, useCategories, useLikes, useMe, useMyItems } from "@/lib/client/hooks";
import { useListingActions } from "@/lib/client/listings";
import type { Me } from "@/lib/dto";
import { LEGAL_LINKS, SITE } from "@/lib/site";
import { useRecentSearches } from "@/lib/client/stores/recentSearches";
import { useUi } from "@/lib/client/stores/ui";
import { formatPrice } from "@/lib/format";

export function ProfileView() {
  const { data: me, error, mutate } = useMe();
  const [tab, setTab] = useState<"listings" | "wanted">("listings");
  const [editing, setEditing] = useState(false);
  const [locating, setLocating] = useState(false);
  // Same SWR keys the tab bodies use, so this costs no extra requests.
  const { data: myItems } = useMyItems();
  const { data: likes } = useLikes();
  const counts = { listings: myItems?.length, wanted: likes?.length };

  if (error) return <ErrorNote message={error.message} onRetry={() => mutate()} />;
  if (!me) return <Spinner />;

  return (
    // md: one centred column. lg and up: profile + interests on the left (sticky), listings on the right.
    <div className="pb-10 md:mx-auto md:w-full md:max-w-3xl md:pt-6 lg:grid lg:max-w-6xl lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-6 lg:px-4 lg:pt-8">
      <div className="lg:sticky lg:top-8 lg:self-start">
        <section className="mx-4 mt-2 rounded-[28px] bg-honey p-5">
          <div className="flex items-center gap-4">
            <Avatar user={me} size={76} ring />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-black">{me.name}</h1>
              <button
                onClick={() => setLocating(true)}
                className="mt-0.5 flex items-center gap-1 text-sm font-semibold underline-offset-2 hover:underline"
              >
                <PinIcon size={14} /> {me.area ?? "Set your location"} · {me.radiusKm} km
              </button>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white"
              aria-label="Edit profile"
            >
              <PencilIcon size={17} />
            </button>
          </div>
          {me.bio && <p className="mt-4 text-sm leading-relaxed">{me.bio}</p>}
          <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              ["Passed on", me.stats.given],
              ["Received", me.stats.got],
              ["Connections", me.stats.connections],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white/60 py-2.5">
                <dd className="text-xl font-black">{value}</dd>
                <dt className="text-xs font-semibold">{label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <Interests me={me} />
        <div className="hidden lg:block">
          <AccountActions />
        </div>
      </div>

      <div>
        <div className="mx-4 mt-8 grid grid-cols-2 gap-1 rounded-full bg-white p-1 lg:mt-2" role="tablist">
          {(["listings", "wanted"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full py-2.5 text-sm font-bold transition ${tab === t ? "bg-ink text-white" : "text-ink-soft"}`}
            >
              {t === "listings" ? "My listings" : "Things I want"}
              {counts[t] !== undefined && <span className="ml-1 opacity-60">{counts[t]}</span>}
            </button>
          ))}
        </div>
        {tab === "listings" ? <MyListings /> : <Wanted />}
      </div>

      <div className="lg:hidden">
        <AccountActions />
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit profile">
        <EditProfile me={me} onDone={() => setEditing(false)} />
      </Sheet>
      <Sheet open={locating} onClose={() => setLocating(false)} title="Your location">
        <LocationForm me={me} onDone={() => setLocating(false)} />
      </Sheet>
    </div>
  );
}

function Interests({ me }: { me: Me }) {
  const { data: categories } = useCategories();
  const { mutate } = useSWRConfig();
  const showToast = useUi((s) => s.showToast);
  // Saves run one at a time, in order, so quick taps reach the server in the order they were made.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  /** Like the app: the chip flips at once; the save follows, and a failure puts things back. */
  function toggle(id: string) {
    const current = (cacheMe() ?? me).interests;
    const interests = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    void mutate<Me>("/api/me", (m) => m && { ...m, interests }, { revalidate: false });
    queue.current = queue.current.then(async () => {
      try {
        await api<Me>("PATCH", "/api/me", { interests });
        mutate((key) => typeof key === "string" && key.startsWith("/api/feed"));
      } catch (e) {
        await mutate("/api/me");
        showToast(`Couldn't save your interests. ${e instanceof ApiRequestError ? e.message : "Please try again."}`);
      }
    });
  }
  const { cache } = useSWRConfig();
  const cacheMe = () => cache.get("/api/me")?.data as Me | undefined;

  return (
    <section className="mt-6 px-4">
      <h2 className="font-extrabold">What are you looking for?</h2>
      <p className="mb-3 text-sm text-ink-soft">We&apos;ll show these first in your feed.</p>
      <div className="flex flex-wrap gap-2">
        {categories?.map((c) => {
          const on = me.interests.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}

              aria-pressed={on}
              className={`inline-flex items-center gap-1 rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition ${
                on ? "border-honey bg-honey" : "border-line bg-white hover:border-ink"
              }`}
            >
              {on && <CheckIcon size={14} />}
              <span aria-hidden="true">{c.emoji}</span> {c.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MyListings() {
  const { data, error, mutate } = useMyItems();
  const { setStatus, markGiven, remove } = useListingActions();

  function confirmRemove(id: string) {
    if (confirm("Remove this listing? People you're chatting with will see it's no longer available.")) void remove(id);
  }

  if (error) return <ErrorNote message={error.message} onRetry={() => mutate()} />;
  if (!data) return <Spinner />;
  if (data.length === 0) {
    return (
      <EmptyState
        emoji="📦"
        title="Nothing listed yet"
        body="Got something you don't use anymore? Someone nearby probably needs it."
        action={
          <Link href="/new" className="rounded-full bg-ink px-6 py-3 font-bold text-white">
            List your first item
          </Link>
        }
      />
    );
  }

  return (
    <ul className="mt-4 space-y-3 px-4 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
      {data.map((item) => (
        <li key={item.id} className="flex gap-3 rounded-[22px] bg-white p-3">
          <Link
            href={`/listing/${item.id}`}
            className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-2xl"
            aria-label={`Preview ${item.title}`}
          >
            <Photo src={item.photos[0]} alt={item.title} sizes="80px" />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/listing/${item.id}`} className="truncate font-bold hover:underline">
                {item.title}
              </Link>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase ${
                  item.status === "active" ? "bg-[#DDF4E4] text-[#146C2E]" : "bg-line text-ink-soft"
                }`}
              >
                {item.status === "active" ? "Live" : "Given"}
              </span>
            </div>
            <p className="text-sm text-ink-soft">
              {formatPrice(item.priceInr)} · {item.viewCount} {item.viewCount === 1 ? "view" : "views"} · {item.connectionCount}{" "}
              {item.connectionCount === 1 ? "person wants it" : "people want it"}
            </p>
            <div className="mt-auto flex gap-2 pt-2">
              {item.status === "active" ? (
                <button
                  onClick={() => markGiven(item.id)}
                  className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white"
                >
                  Mark as given
                </button>
              ) : (
                <button
                  onClick={() => void setStatus(item.id, "active")}
                  className="rounded-full border-2 border-ink px-3 py-1 text-xs font-bold"
                >
                  Relist
                </button>
              )}
              <button
                onClick={() => confirmRemove(item.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-[#FFE4E0] hover:text-[#B42318]"
                aria-label={`Remove ${item.title}`}
              >
                <TrashIcon size={16} />
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Wanted() {
  const { data, error, mutate } = useLikes();
  if (error) return <ErrorNote message={error.message} onRetry={() => mutate()} />;
  if (!data) return <Spinner />;
  if (data.length === 0) {
    return (
      <EmptyState
        emoji="💛"
        title="No likes yet"
        body="Items you swipe right on show up here."
        action={
          <Link href="/feed" className="rounded-full bg-ink px-6 py-3 font-bold text-white">
            Start swiping
          </Link>
        }
      />
    );
  }
  return (
    <ul className="mt-4 grid grid-cols-2 gap-3 px-4 md:grid-cols-3">
      {data.map(({ connectionId, item, owner }) => (
        <li key={connectionId}>
          <Link href={`/chat/${connectionId}`} className="block overflow-hidden rounded-[22px] bg-white">
            <span className="relative block aspect-square">
              <Photo src={item.photo} alt={item.title} sizes="220px" className={item.status === "active" ? "" : "grayscale"} />
              {item.status !== "active" && (
                <span className="absolute top-2 left-2 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">
                  Taken
                </span>
              )}
            </span>
            <span className="block p-3">
              <span className="block truncate text-sm font-bold">{item.title}</span>
              <span className="block truncate text-xs text-ink-soft">
                {formatPrice(item.priceInr)} · {owner.name.split(" ")[0]}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EditProfile({ me, onDone }: { me: Me; onDone: () => void }) {
  const { mutate } = useSWRConfig();
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio);
  /** Picked but not yet uploaded — the upload happens on Save, so abandoned picks cost nothing. */
  const [picked, setPicked] = useState<{ file: File; preview: string } | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const busy = phase !== "idle";
  const [error, setError] = useState<string | null>(null);

  // Free the previous preview when a new photo is picked or the form closes.
  useEffect(() => {
    if (!picked) return;
    return () => URL.revokeObjectURL(picked.preview);
  }, [picked]);

  function pickAvatar(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPicked({ file, preview: URL.createObjectURL(file) });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let avatarUrl: string | undefined;
    if (picked) {
      setPhase("uploading");
      try {
        avatarUrl = await uploadImage(picked.file);
      } catch (err) {
        setError(err instanceof ApiRequestError ? err.message : "Photo upload failed. Try again.");
        return setPhase("idle");
      }
    }
    setPhase("saving");
    try {
      const updated = await api<Me>("PATCH", "/api/me", { name, bio, ...(avatarUrl && { avatarUrl }) });
      await mutate("/api/me", updated, { revalidate: false });
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't save.");
    } finally {
      setPhase("idle");
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <label className="mx-auto flex w-fit cursor-pointer flex-col items-center gap-2">
        <span className="relative">
          <Avatar user={{ name, avatarUrl: picked?.preview ?? me.avatarUrl }} size={96} />
          <span className="absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white">
            <CameraIcon size={16} />
          </span>
        </span>
        <span className="text-sm font-bold">Change photo</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            pickAvatar(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="w-full rounded-2xl border-2 border-line px-4 py-3 outline-none focus:border-honey"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">About you</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Decluttering, moving, or just love passing things on?"
          className="w-full resize-none rounded-2xl border-2 border-line px-4 py-3 outline-none focus:border-honey"
        />
      </label>
      {error && (
        <p className="text-sm font-medium text-[#B42318]" role="alert">
          {error}
        </p>
      )}
      <button disabled={busy} className="w-full rounded-full bg-ink px-5 py-3.5 font-bold text-white disabled:opacity-60">
        {phase === "uploading" ? "Uploading photo…" : phase === "saving" ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

/**
 * Leaving the signed-in app is a full page load on purpose: it drops the SWR cache, every zustand
 * store (swiped items, chats, match overlay) and the socket, so the next person on this browser
 * never sees the previous account's data.
 */
function leaveApp(to: string) {
  // Recent searches live in localStorage, which a reload doesn't clear; they're this account's.
  useRecentSearches.getState().clear();
  window.location.replace(to);
}

function AccountActions() {
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function signOut() {
    setBusy(true);
    await api("DELETE", "/api/auth/session").catch(() => undefined);
    leaveApp("/login");
  }

  return (
    <div className="mt-10 flex flex-col items-center gap-3 px-4">
      <BlockedPeople />
      <nav className="mb-4 w-full overflow-hidden rounded-[22px] bg-white" aria-label="Help and legal">
        {LEGAL_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center justify-between border-b border-line px-4 py-3.5 text-sm font-semibold last:border-b-0 hover:bg-cream"
          >
            {l.label}{" "}
            <span aria-hidden="true" className="text-ink-soft">
              ›
            </span>
          </Link>
        ))}
        <a
          href={`mailto:${SITE.supportEmail}`}
          className="flex items-center justify-between px-4 py-3.5 text-sm font-semibold hover:bg-cream"
        >
          Contact us{" "}
          <span aria-hidden="true" className="text-ink-soft">
            ›
          </span>
        </a>
      </nav>
      <button
        onClick={signOut}
        disabled={busy}
        className="w-full rounded-full border-2 border-ink py-3 font-bold transition hover:bg-ink hover:text-white"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      <button onClick={() => setDeleting(true)} disabled={busy} className="text-sm font-semibold text-[#B42318] underline">
        Delete my account
      </button>
      <Sheet open={deleting} onClose={() => setDeleting(false)} title="Delete account">
        <DeleteAccountForm />
      </Sheet>
    </div>
  );
}

function DeleteAccountForm() {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("DELETE", "/api/me");
      leaveApp("/");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't delete account.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={confirm} className="space-y-4">
      <p className="leading-relaxed">
        This permanently deletes your account, listings and chats. Type <strong>DELETE</strong> to confirm.
      </p>
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoCapitalize="characters"
        autoComplete="off"
        placeholder="DELETE"
        aria-label="Type DELETE to confirm"
        className="w-full rounded-2xl border-2 border-line px-4 py-3 outline-none focus:border-[#B42318]"
      />
      {error && (
        <p className="text-sm font-medium text-[#B42318]" role="alert">
          {error}
        </p>
      )}
      <button
        disabled={busy || typed.trim() !== "DELETE"}
        className="w-full rounded-full bg-[#B42318] px-5 py-3.5 font-bold text-white disabled:opacity-40"
      >
        {busy ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}

/** People I've blocked, with Unblock. Hidden when there are none. */
function BlockedPeople() {
  const { data, mutate } = useBlocked();
  const { mutate: globalMutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  if (!data?.length) return null;

  async function unblock(id: string) {
    mutate(
      data?.filter((u) => u.id !== id),
      { revalidate: false },
    );
    await api("DELETE", `/api/users/${id}/block`).catch(() => undefined);
    mutate();
    globalMutate((key) => typeof key === "string" && key.startsWith("/api/feed"));
  }

  return (
    <section className="mb-2 w-full overflow-hidden rounded-[22px] bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3.5 text-sm font-semibold hover:bg-cream"
      >
        Blocked people ({data.length}){" "}
        <span aria-hidden="true" className="text-ink-soft">
          {open ? "⌃" : "⌄"}
        </span>
      </button>
      {open && (
        <ul className="border-t border-line">
          {data.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar user={u} size={34} />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{u.name}</span>
              <button
                onClick={() => unblock(u.id)}
                className="rounded-full border-2 border-ink px-3 py-1 text-xs font-bold hover:bg-ink hover:text-white"
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
