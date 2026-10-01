"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Re-runs the page's server queries every `seconds` (pausable), so status pages stay live. */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  const [on, setOn] = useState(true);
  const [at, setAt] = useState(() => new Date());

  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => {
      router.refresh();
      setAt(new Date());
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [on, seconds, router]);

  return (
    <label className="flex items-center gap-2 text-xs text-zinc-500">
      <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="accent-zinc-900" />
      Auto-refresh every {seconds}s · updated {at.toLocaleTimeString()}
    </label>
  );
}
