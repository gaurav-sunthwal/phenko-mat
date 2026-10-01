"use client";

import { useCategories } from "@/lib/client/hooks";

export function CategoryTitle({ id }: { id: string }) {
  const { data } = useCategories();
  const c = data?.find((x) => x.id === id);
  return (
    <h1 className="text-xl font-extrabold">
      {c ? (
        <>
          <span aria-hidden="true">{c.emoji}</span> {c.name}
        </>
      ) : (
        " "
      )}
    </h1>
  );
}
