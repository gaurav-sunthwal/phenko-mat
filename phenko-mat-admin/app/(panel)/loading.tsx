/** Shown instantly while a panel page's data loads (each query is a round trip to the database). */
export default function Loading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading">
      <div className="mb-6 h-8 w-48 rounded-lg bg-zinc-200" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-zinc-200" />
        ))}
      </div>
      <div className="mt-6 h-72 rounded-xl bg-zinc-200" />
    </div>
  );
}
