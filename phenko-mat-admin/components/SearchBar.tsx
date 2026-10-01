/** GET form: search box + a select filter, submitted as query params (works without JS). */
export function SearchBar({
  q,
  placeholder,
  filter,
}: {
  q?: string;
  placeholder: string;
  filter: { name: string; value?: string; options: { value: string; label: string }[] };
}) {
  return (
    <form className="flex flex-wrap gap-2" role="search">
      <input
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        className="w-72 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
      />
      <select
        name={filter.name}
        defaultValue={filter.value ?? filter.options[0].value}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
      >
        {filter.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">Search</button>
    </form>
  );
}
