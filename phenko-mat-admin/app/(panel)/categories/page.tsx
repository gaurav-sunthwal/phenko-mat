import { deleteCategory, renameCategory } from "@/app/actions";
import { ActionForm, inputCls } from "@/components/ActionForm";
import { Badge, Card, PageHeader, td, th } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { listCategories } from "@/lib/queries";

export const metadata = { title: "Categories · Phenko Mat Admin" };

export default async function CategoriesPage() {
  const list = await listCategories();
  const targets = list.map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}` }));

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Built-in categories come from the app's seed script; custom ones are created by users and can be edited, merged or deleted here."
      />
      <Card>
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200">
            <tr>
              <th className={th}>Category</th>
              <th className={th}>Type</th>
              <th className={th}>Active listings</th>
              <th className={th}>All listings</th>
              <th className={th}>Interested users</th>
              <th className={th}>Created</th>
              <th className={th}>Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {list.map((c) => (
              <tr key={c.id} className="align-top">
                <td className={td}>
                  <span className="font-semibold">
                    {c.emoji} {c.name}
                  </span>
                  <span className="block font-mono text-xs text-zinc-400">{c.id}</span>
                </td>
                <td className={td}>
                  <Badge tone={c.group === "custom" ? "amber" : "zinc"}>{c.group === "custom" ? "custom" : "built-in"}</Badge>
                </td>
                <td className={td}>{c.active_items}</td>
                <td className={td}>{c.all_items}</td>
                <td className={td}>{c.interested}</td>
                <td className={`${td} text-zinc-500`}>
                  {formatDate(c.created_at)}
                  {c.created_by_name && <span className="block text-xs">by {c.created_by_name}</span>}
                </td>
                <td className={`${td} w-80`}>
                  {c.group === "custom" ? (
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-zinc-700">Edit / delete</summary>
                      <div className="mt-3 space-y-4">
                        <ActionForm action={renameCategory} fields={{ id: c.id }} label="Save" pendingLabel="Saving…" tone="primary">
                          <div className="flex gap-2">
                            <input name="emoji" defaultValue={c.emoji} maxLength={16} className={`${inputCls} w-16`} aria-label="Emoji" />
                            <input name="name" defaultValue={c.name} maxLength={40} className={inputCls} aria-label="Name" />
                          </div>
                        </ActionForm>
                        <ActionForm
                          action={deleteCategory}
                          fields={{ id: c.id }}
                          label="Delete category"
                          pendingLabel="Deleting…"
                          tone="danger"
                          confirm={`Delete “${c.name}”? Listings keep their other categories${c.all_items ? "; choosing “merge into” moves them first" : ""}.`}
                        >
                          <select name="into" defaultValue="" className={inputCls} aria-label="Merge into">
                            <option value="">Don&apos;t merge (just delete)</option>
                            {targets
                              .filter((t) => t.id !== c.id)
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  Merge into {t.label}
                                </option>
                              ))}
                          </select>
                        </ActionForm>
                      </div>
                    </details>
                  ) : (
                    <span className="text-xs text-zinc-400">Managed in code</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
