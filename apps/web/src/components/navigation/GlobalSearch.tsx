import { Search } from "lucide-react";

export function GlobalSearch() {
  return (
    <label className="relative hidden min-w-[220px] flex-1 md:block lg:max-w-md">
      <span className="sr-only">Search</span>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]"
        aria-hidden
      />
      <input
        type="search"
        placeholder="Search assets, incidents, controls…"
        className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] py-2 pr-3 pl-10 text-sm text-[var(--text)] placeholder:text-[var(--muted)]"
        disabled
        aria-disabled="true"
        title="Search arrives in a later phase"
      />
    </label>
  );
}
