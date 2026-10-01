import "server-only";
import { getDb, schema } from "@/db";
import type { Admin } from "./auth";

export type AuditAction =
  | "listing.remove"
  | "reports.dismiss"
  | "user.suspend"
  | "user.unsuspend"
  | "user.delete"
  | "category.rename"
  | "category.delete"
  | "errors.clear";

/** Records an admin action. Never throws: a failed audit write mustn't undo the action itself. */
export async function audit(admin: Admin, action: AuditAction, target: { type: string; id: string }, summary?: string) {
  await getDb()
    .insert(schema.adminActions)
    .values({ adminEmail: admin.email, action, targetType: target.type, targetId: target.id, summary: summary?.slice(0, 500) })
    .catch((e) => console.error("[admin] audit write failed", e));
}
