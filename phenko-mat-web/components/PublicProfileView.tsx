"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "./icons";
import { ReportSheet } from "./ReportSheet";
import { Avatar, EmptyState, ErrorNote, Photo, Spinner } from "./ui";
import { ApiRequestError } from "@/lib/client/api";
import { useMe, usePublicProfile } from "@/lib/client/hooks";
import { useBlockUser, type ReportTarget } from "@/lib/client/safety";
import { formatPrice } from "@/lib/format";

const monthYear = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

/** Someone else's profile: who they are, how much they've given, their live listings. */
export function PublicProfileView({ id }: { id: string }) {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: profile, error, mutate } = usePublicProfile(id);
  const block = useBlockUser();
  const [reporting, setReporting] = useState<ReportTarget | null>(null);

  // Your own public profile is just your profile.
  useEffect(() => {
    if (me && me.id === id) router.replace("/profile");
  }, [me, id, router]);

  const back = (
    <button
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/feed"))}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
      aria-label="Back"
    >
      <ArrowLeftIcon size={18} />
    </button>
  );

  if (error) {
    const gone = error instanceof ApiRequestError && error.status === 404;
    return (
      <div className="flex min-h-dvh flex-col px-4 pt-3">
        {back}
        {gone ? (
          <EmptyState emoji="🫥" title="Profile not available" body="This person may have deleted their account." />
        ) : (
          <ErrorNote message={error.message} onRetry={() => mutate()} />
        )}
      </div>
    );
  }
  if (!profile) return <Spinner />;

  const first = profile.name.split(" ")[0];

  return (
    <div className="flex min-h-dvh flex-col px-4 pt-3 pb-10 md:mx-auto md:w-full md:max-w-3xl md:pt-8">
      {back}
      <section className="mt-3 rounded-[28px] bg-honey p-5">
        <div className="flex items-center gap-4">
          <Avatar user={profile} size={76} ring />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black">{profile.name}</h1>
            <p className="text-sm font-semibold">
              {profile.area ? `${profile.area} · ` : ""}Member since {monthYear.format(new Date(profile.memberSince))}
            </p>
          </div>
        </div>
        {profile.bio && <p className="mt-4 text-sm leading-relaxed">{profile.bio}</p>}
        <dl className="mt-5 grid grid-cols-2 gap-2 text-center">
          {(
            [
              ["Passed on", profile.stats.given],
              ["Received", profile.stats.got],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white/60 py-2.5">
              <dd className="text-xl font-black">{value}</dd>
              <dt className="text-xs font-semibold">{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <h2 className="mt-8 mb-3 text-lg font-extrabold">
        {profile.listings.length ? `${first}'s listings` : `${first} has nothing listed right now`}
      </h2>
      {profile.listings.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {profile.listings.map((l) => (
            <li key={l.id}>
              <Link href={`/listing/${l.id}`} className="block overflow-hidden rounded-[22px] bg-white">
                <span className="relative block aspect-square">
                  <Photo src={l.photo} alt={l.title} sizes="220px" />
                </span>
                <span className="block p-3">
                  <span className="block truncate text-sm font-bold">{l.title}</span>
                  <span className="block text-xs text-ink-soft">{formatPrice(l.priceInr)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold">
        <button onClick={() => setReporting({ kind: "user", id: profile.id, name: profile.name })} className="text-ink-soft underline hover:text-ink">
          Report {first}
        </button>
        <button
          onClick={async () => {
            if (await block(profile)) router.replace("/feed");
          }}
          className="text-[#B42318] underline"
        >
          Block {first}
        </button>
      </div>
      <ReportSheet target={reporting} onClose={() => setReporting(null)} />
    </div>
  );
}
