import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const PAGE_SIZE = 25;

const rows = async <T>(query: ReturnType<typeof sql>) => (await getDb().execute<T & Record<string, unknown>>(query)).rows as T[];

/* ---------- dashboard ---------- */

export interface DashboardStats {
  users: number;
  users_7d: number;
  suspended: number;
  active_listings: number;
  listings_7d: number;
  given: number;
  connections: number;
  connections_7d: number;
  messages_7d: number;
  open_listing_reports: number;
  open_person_reports: number;
}

export async function dashboardStats() {
  // Two independent queries: run them in parallel (each is a round trip to the database).
  const statsQuery = rows<DashboardStats>(sql`
    select
      (select count(*)::int from users) as users,
      (select count(*)::int from users where created_at > now() - interval '7 days') as users_7d,
      (select count(*)::int from users where banned_at is not null) as suspended,
      (select count(*)::int from items where status = 'active') as active_listings,
      (select count(*)::int from items where created_at > now() - interval '7 days') as listings_7d,
      (select count(*)::int from items where status = 'given') as given,
      (select count(*)::int from connections) as connections,
      (select count(*)::int from connections where created_at > now() - interval '7 days') as connections_7d,
      (select count(*)::int from messages where created_at > now() - interval '7 days') as messages_7d,
      (select count(distinct item_id)::int from reports where item_id is not null and resolved_at is null) as open_listing_reports,
      (select count(distinct reported_user_id)::int from reports where item_id is null and resolved_at is null) as open_person_reports
  `);
  const dailyQuery = rows<{ day: string; signups: number; listings: number }>(sql`
    select to_char(d, 'YYYY-MM-DD') as day,
           (select count(*)::int from users u where u.created_at >= d and u.created_at < d + interval '1 day') as signups,
           (select count(*)::int from items i where i.created_at >= d and i.created_at < d + interval '1 day') as listings
    from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d
    order by d
  `);
  const [[stats], daily] = await Promise.all([statsQuery, dailyQuery]);
  return { stats, daily };
}

/* ---------- reports ---------- */

export interface ReportedListing {
  item_id: string;
  title: string;
  photo: string | null;
  status: "active" | "given" | "removed";
  owner_id: string;
  owner_name: string;
  owner_banned: boolean;
  report_count: number;
  reasons: string[];
  latest_at: string;
}

/** Listings by number of reports (open ones unless `resolved`), most reported first. */
export function reportedListings({ resolved = false, limit = PAGE_SIZE } = {}) {
  return rows<ReportedListing>(sql`
    select i.id as item_id, i.title, i.photos[1] as photo, i.status,
           u.id as owner_id, u.name as owner_name, (u.banned_at is not null) as owner_banned,
           count(*)::int as report_count, array_agg(distinct r.reason::text) as reasons, max(r.created_at) as latest_at
    from reports r
    join items i on i.id = r.item_id
    join users u on u.id = i.owner_id
    where ${resolved ? sql`r.resolved_at is not null` : sql`r.resolved_at is null`}
    group by i.id, u.id
    order by report_count desc, latest_at desc
    limit ${limit}
  `);
}

export interface ReportedPerson {
  user_id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  banned: boolean;
  report_count: number;
  listing_report_count: number;
  reasons: string[];
  latest_at: string;
}

/** People reported directly (from a profile or chat), most reported first. */
export function reportedPeople({ resolved = false, limit = PAGE_SIZE } = {}) {
  return rows<ReportedPerson>(sql`
    select u.id as user_id, u.name, u.email, u.avatar_url, (u.banned_at is not null) as banned,
           count(*)::int as report_count,
           (select count(*)::int from reports lr where lr.reported_user_id = u.id and lr.item_id is not null) as listing_report_count,
           array_agg(distinct r.reason::text) as reasons, max(r.created_at) as latest_at
    from reports r
    join users u on u.id = r.reported_user_id
    where r.item_id is null and ${resolved ? sql`r.resolved_at is not null` : sql`r.resolved_at is null`}
    group by u.id
    order by report_count desc, latest_at desc
    limit ${limit}
  `);
}

export interface ReportRow {
  id: string;
  reason: string;
  details: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution: string | null;
  resolved_by: string | null;
  reporter_id: string;
  reporter_name: string;
  item_id: string | null;
  item_title: string | null;
}

const reportSelect = sql`
  select r.id, r.reason::text as reason, r.details, r.created_at, r.resolved_at, r.resolution, r.resolved_by,
         rep.id as reporter_id, rep.name as reporter_name, r.item_id, i.title as item_title
  from reports r
  join users rep on rep.id = r.reporter_id
  left join items i on i.id = r.item_id`;

export const reportsForItem = (itemId: string) =>
  rows<ReportRow>(sql`${reportSelect} where r.item_id = ${itemId} order by r.created_at desc`);

/** Everything reported about a person: direct reports and reports on their listings. */
export const reportsAgainstUser = (userId: string) =>
  rows<ReportRow>(sql`${reportSelect} where r.reported_user_id = ${userId} order by r.created_at desc limit 100`);

/* ---------- listings ---------- */

export interface ListingRow {
  id: string;
  title: string;
  photo: string | null;
  status: "active" | "given" | "removed";
  price_inr: number;
  area: string;
  created_at: string;
  owner_id: string;
  owner_name: string;
  connections: number;
  open_reports: number;
  total: number;
}

export function listListings({ q, status, page = 1 }: { q?: string; status?: string; page?: number }) {
  const like = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : null;
  return rows<ListingRow>(sql`
    select i.id, i.title, i.photos[1] as photo, i.status, i.price_inr, i.area, i.created_at,
           u.id as owner_id, u.name as owner_name,
           (select count(*)::int from connections c where c.item_id = i.id) as connections,
           (select count(*)::int from reports r where r.item_id = i.id and r.resolved_at is null) as open_reports,
           count(*) over ()::int as total
    from items i join users u on u.id = i.owner_id
    where true
      ${like ? sql`and (i.title ilike ${like} or i.description ilike ${like} or u.name ilike ${like} or i.id::text = ${q})` : sql``}
      ${status && status !== "all" ? sql`and i.status = ${status}::item_status` : sql``}
    order by i.created_at desc
    limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}
  `);
}

export interface ListingDetail {
  id: string;
  title: string;
  description: string;
  photos: string[];
  status: "active" | "given" | "removed";
  condition: string;
  price_inr: number;
  area: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  owner_name: string;
  owner_email: string | null;
  owner_banned: boolean;
  given_to_name: string | null;
  categories: string[] | null;
  connections: number;
  views: number;
}

export async function listingDetail(id: string) {
  const [item] = await rows<ListingDetail>(sql`
    select i.id, i.title, i.description, i.photos, i.status, i.condition::text as condition, i.price_inr, i.area,
           i.created_at, i.updated_at,
           u.id as owner_id, u.name as owner_name, u.email as owner_email, (u.banned_at is not null) as owner_banned,
           g.name as given_to_name,
           (select array_agg(c.emoji || ' ' || c.name order by c.name) from item_categories ic join categories c on c.id = ic.category_id
             where ic.item_id = i.id) as categories,
           (select count(*)::int from connections c where c.item_id = i.id) as connections,
           (select count(*)::int from item_views v where v.item_id = i.id) as views
    from items i
    join users u on u.id = i.owner_id
    left join users g on g.id = i.given_to_id
    where i.id = ${id}
  `);
  return item ?? null;
}

/* ---------- users ---------- */

export interface UserRow {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  area: string | null;
  created_at: string;
  banned_at: string | null;
  listings: number;
  open_reports: number;
  total: number;
}

export function listUsers({ q, filter, page = 1 }: { q?: string; filter?: string; page?: number }) {
  const like = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : null;
  return rows<UserRow>(sql`
    select u.id, u.name, u.email, u.avatar_url, u.area, u.created_at, u.banned_at,
           (select count(*)::int from items i where i.owner_id = u.id and i.status <> 'removed') as listings,
           (select count(*)::int from reports r where r.reported_user_id = u.id and r.resolved_at is null) as open_reports,
           count(*) over ()::int as total
    from users u
    where true
      ${like ? sql`and (u.name ilike ${like} or u.email ilike ${like} or u.id::text = ${q})` : sql``}
      ${filter === "suspended" ? sql`and u.banned_at is not null` : sql``}
      ${filter === "reported" ? sql`and exists (select 1 from reports r where r.reported_user_id = u.id and r.resolved_at is null)` : sql``}
    order by u.created_at desc
    limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}
  `);
}

export interface UserDetail {
  id: string;
  firebase_uid: string;
  name: string;
  email: string | null;
  bio: string;
  avatar_url: string | null;
  area: string | null;
  radius_km: number;
  created_at: string;
  banned_at: string | null;
  ban_reason: string | null;
  listed: number;
  given: number;
  got: number;
  connections: number;
  messages: number;
  reports_made: number;
  blocked_by: number;
}

export async function userDetail(id: string) {
  const [user] = await rows<UserDetail>(sql`
    select u.id, u.firebase_uid, u.name, u.email, u.bio, u.avatar_url, u.area, u.radius_km, u.created_at,
           u.banned_at, u.ban_reason,
           (select count(*)::int from items where owner_id = u.id and status <> 'removed') as listed,
           (select count(*)::int from items where owner_id = u.id and status = 'given') as given,
           (select count(*)::int from items where given_to_id = u.id) as got,
           (select count(*)::int from connections where taker_id = u.id or giver_id = u.id) as connections,
           (select count(*)::int from messages where sender_id = u.id) as messages,
           (select count(*)::int from reports where reporter_id = u.id) as reports_made,
           (select count(*)::int from blocks where blocked_id = u.id) as blocked_by
    from users u where u.id = ${id}
  `);
  return user ?? null;
}

export const userListings = (userId: string) =>
  rows<Omit<ListingRow, "owner_id" | "owner_name" | "total">>(sql`
    select i.id, i.title, i.photos[1] as photo, i.status, i.price_inr, i.area, i.created_at,
           (select count(*)::int from connections c where c.item_id = i.id) as connections,
           (select count(*)::int from reports r where r.item_id = i.id and r.resolved_at is null) as open_reports
    from items i where i.owner_id = ${userId}
    order by i.created_at desc limit 100
  `);

/* ---------- categories ---------- */

export interface CategoryRow {
  id: string;
  name: string;
  emoji: string;
  group: "tier" | "kind" | "custom";
  created_at: string;
  created_by_name: string | null;
  active_items: number;
  all_items: number;
  interested: number;
}

export const listCategories = () =>
  rows<CategoryRow>(sql`
    select c.id, c.name, c.emoji, c."group", c.created_at, u.name as created_by_name,
           (select count(*)::int from item_categories ic join items i on i.id = ic.item_id
             where ic.category_id = c.id and i.status = 'active') as active_items,
           (select count(*)::int from item_categories ic where ic.category_id = c.id) as all_items,
           (select count(*)::int from user_interests ui where ui.category_id = c.id) as interested
    from categories c left join users u on u.id = c.created_by
    order by case c."group" when 'tier' then 0 when 'kind' then 1 else 2 end, c.name
  `);

/* ---------- audit ---------- */

export interface AuditRow {
  id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  summary: string | null;
  created_at: string;
  total: number;
}

export const auditLog = (page = 1) =>
  rows<AuditRow>(sql`
    select *, count(*) over ()::int as total from admin_actions
    order by created_at desc limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}
  `);

/* ---------- health (request stats) ---------- */

export interface TrafficSummary {
  total: number;
  errors_5xx: number;
  errors_4xx: number;
  slow: number;
  avg_ms: number | null;
  max_ms: number | null;
}

export interface TrafficHour {
  hour: string;
  total: number;
  errors_5xx: number;
  errors_4xx: number;
}

export interface RouteHealth {
  route: string;
  total: number;
  errors_5xx: number;
  errors_4xx: number;
  slow: number;
  avg_ms: number;
  max_ms: number;
}

/** API traffic over the last `hours`: totals, per-hour series, and per-route breakdown. */
export async function traffic(hours = 24) {
  const since = sql`now() - make_interval(hours => ${hours})`;
  const [summary, series, routes, errorsBySource] = await Promise.all([
    rows<TrafficSummary>(sql`
      select coalesce(sum(total), 0)::int as total, coalesce(sum(errors_5xx), 0)::int as errors_5xx,
             coalesce(sum(errors_4xx), 0)::int as errors_4xx, coalesce(sum(slow), 0)::int as slow,
             round(sum(duration_ms_sum)::numeric / nullif(sum(total), 0))::int as avg_ms, max(duration_ms_max) as max_ms
      from request_stats where minute >= ${since}`),
    rows<TrafficHour>(sql`
      select to_char(h, 'HH24:00') as hour,
             coalesce(sum(s.total), 0)::int as total, coalesce(sum(s.errors_5xx), 0)::int as errors_5xx,
             coalesce(sum(s.errors_4xx), 0)::int as errors_4xx
      from generate_series(date_trunc('hour', now()) - make_interval(hours => ${hours - 1}), date_trunc('hour', now()), interval '1 hour') h
      left join request_stats s on s.minute >= h and s.minute < h + interval '1 hour'
      group by h order by h`),
    rows<RouteHealth>(sql`
      select route, sum(total)::int as total, sum(errors_5xx)::int as errors_5xx, sum(errors_4xx)::int as errors_4xx,
             sum(slow)::int as slow, round(sum(duration_ms_sum)::numeric / nullif(sum(total), 0))::int as avg_ms,
             max(duration_ms_max) as max_ms
      from request_stats where minute >= ${since}
      group by route order by sum(errors_5xx) desc, avg_ms desc limit 30`),
    rows<{ source: string; events: number }>(sql`
      select source, count(*)::int as events from error_events where created_at >= ${since} group by source order by events desc`),
  ]);
  return { summary: summary[0], series, routes, errorsBySource };
}

/* ---------- errors ---------- */

export interface ErrorGroup {
  fingerprint: string;
  source: string;
  route: string | null;
  code: string | null;
  status: number | null;
  message: string;
  events: number;
  users: number;
  first_at: string;
  last_at: string;
}

export function errorGroups({ hours, source }: { hours: number; source?: string }) {
  return rows<ErrorGroup>(sql`
    select fingerprint,
           (array_agg(source order by created_at desc))[1] as source,
           (array_agg(route order by created_at desc))[1] as route,
           (array_agg(code order by created_at desc))[1] as code,
           (array_agg(status order by created_at desc))[1] as status,
           (array_agg(message order by created_at desc))[1] as message,
           count(*)::int as events, count(distinct user_id)::int as users,
           min(created_at) as first_at, max(created_at) as last_at
    from error_events
    where created_at >= now() - make_interval(hours => ${hours})
      ${source && source !== "all" ? sql`and source = ${source}` : sql``}
    group by fingerprint
    order by events desc, last_at desc
    limit 200
  `);
}

export const errorCountsBySource = (hours: number) =>
  rows<{ source: string; events: number }>(sql`
    select source, count(*)::int as events from error_events
    where created_at >= now() - make_interval(hours => ${hours}) group by source order by events desc`);

export interface ErrorEvent {
  id: string;
  source: string;
  level: string;
  route: string | null;
  method: string | null;
  status: number | null;
  code: string | null;
  message: string;
  stack: string | null;
  user_id: string | null;
  user_name: string | null;
  meta: string | null;
  created_at: string;
}

export const errorEventsFor = (fingerprint: string) =>
  rows<ErrorEvent>(sql`
    select e.id, e.source, e.level, e.route, e.method, e.status, e.code, e.message, e.stack, e.user_id, u.name as user_name,
           e.meta, e.created_at
    from error_events e left join users u on u.id = e.user_id
    where e.fingerprint = ${fingerprint}
    order by e.created_at desc limit 50
  `);
