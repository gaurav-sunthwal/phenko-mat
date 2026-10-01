import "server-only";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Category } from "@/lib/dto";
import { conflict } from "../errors";

export async function listCategories(userId: string): Promise<Category[]> {
  // Counts only active items within the user's radius, so tiles reflect what they can actually swipe.
  const result = await getDb().execute<{
    id: string;
    name: string;
    emoji: string;
    group: Category["group"];
    blurb: string | null;
    nearby_count: number;
    total_count: number;
  }>(sql`
    with me as (select location, radius_km from users where id = ${userId}),
    nearby as (
      select ic.category_id, count(*)::int as n
      from items i
      join item_categories ic on ic.item_id = i.id
      cross join me
      where i.status = 'active' and i.owner_id <> ${userId}
        and me.location is not null
        and ST_DWithin(i.location, me.location, me.radius_km * 1000)
      group by ic.category_id
    ),
    everywhere as (
      select ic.category_id, count(*)::int as n
      from items i
      join item_categories ic on ic.item_id = i.id
      where i.status = 'active' and i.owner_id <> ${userId}
      group by ic.category_id
    )
    select c.id, c.name, c.emoji, c."group", c.blurb,
           coalesce(n.n, 0) as nearby_count, coalesce(e.n, 0) as total_count
    from categories c
    left join nearby n on n.category_id = c.id
    left join everywhere e on e.category_id = c.id
    order by case c."group" when 'tier' then 0 when 'kind' then 1 else 2 end, c.created_at, c.name
  `);
  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    group: r.group,
    blurb: r.blurb,
    nearbyCount: Number(r.nearby_count),
    totalCount: Number(r.total_count),
  }));
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "category"
  );
}

export async function createCategory(userId: string, input: { name: string; emoji: string }) {
  const db = getDb();
  const base = slugify(input.name);
  const existing = await db.execute<{ id: string }>(
    sql`select id from categories where lower(name) = lower(${input.name}) or id = ${base} limit 1`,
  );
  if (existing.rows[0]) throw conflict("That category already exists.", "CATEGORY_EXISTS");

  const [created] = await db
    .insert(schema.categories)
    .values({ id: base, name: input.name, emoji: input.emoji, group: "custom", createdBy: userId })
    .onConflictDoNothing()
    .returning();
  if (!created) throw conflict("That category already exists.", "CATEGORY_EXISTS");
  return created;
}
