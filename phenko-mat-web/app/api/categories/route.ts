import { authedRoute, readJson } from "@/lib/server/api";
import { createCategory, listCategories } from "@/lib/server/services/categories";
import { categoryCreateSchema } from "@/lib/validation";

export const GET = authedRoute(({ user }) => listCategories(user.id));

export const POST = authedRoute(
  async ({ req, user }) => createCategory(user.id, await readJson(req, categoryCreateSchema)),
  { rateLimit: { name: "categories:create", limit: 10, windowSec: 86_400, store: "shared" } },
);
