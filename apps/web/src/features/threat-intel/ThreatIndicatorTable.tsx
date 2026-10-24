import { CatalogPager } from "@/components/navigation/CatalogPager";
import type { IndicatorView } from "@/features/threat-intel/mapThreatIntel";

export type IndicatorTableFilters = {
  search: string;
  indicatorType: string;
  source: string;
  status: string;
  internalMatch: string;
};

export type IndicatorFilterOption = { value: string; label: string };

const selectClass =
  "min-h-11 min-w-[140px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const indicatorTypes: IndicatorFilterOption[] = [
  { value: "ip", label: "IP" },
  { value: "domain", label: "Domain" },
  { value: "url", label: "URL" },
  { value: "file_hash", label: "File hash" },
];

const statuses: IndicatorFilterOption[] = [
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "retracted", label: "Retracted" },
];

const matches: IndicatorFilterOption[] = [
  { value: "true", label: "Internal match" },
  { value: "false", label: "No internal match" },
];

export function ThreatIndicatorTable({
  indicators,
  total,
  page,
  pageSize,
  onPageChange,
  selectedId,
  onSelect,
  filters,
  onFiltersChange,
  sourceOptions,
  emptyLabel,
}: {
  indicators: IndicatorView[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  filters: IndicatorTableFilters;
  onFiltersChange: (filters: IndicatorTableFilters) => void;
  sourceOptions: IndicatorFilterOption[];
  emptyLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
        <div className="min-w-[200px] flex-1">
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="intel-search"
          >
            Search records
          </label>
          <input
            id="intel-search"
            type="search"
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            placeholder="Search records…"
            className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          />
        </div>
        <Filter
          id="intel-type"
          label="Indicator type"
          value={filters.indicatorType}
          onChange={(indicatorType) => onFiltersChange({ ...filters, indicatorType })}
          options={indicatorTypes}
        />
        <Filter
          id="intel-source"
          label="Source"
          value={filters.source}
          onChange={(source) => onFiltersChange({ ...filters, source })}
          options={sourceOptions}
        />
        <Filter
          id="intel-status"
          label="Status"
          value={filters.status}
          onChange={(status) => onFiltersChange({ ...filters, status })}
          options={statuses}
        />
        <Filter
          id="intel-match"
          label="Internal match"
          value={filters.internalMatch}
          onChange={(internalMatch) => onFiltersChange({ ...filters, internalMatch })}
          options={matches}
        />
      </div>

      {indicators.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)] md:block">
            <table className="min-w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Indicator records with value, type, source, last seen, and status. Indicator values
                are plain text.
              </caption>
              <thead className="bg-[var(--raised)] text-[var(--muted)]">
                <tr>
                  {["Indicator", "Type", "Source", "Last seen", "Status"].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-3 py-3 font-medium whitespace-nowrap"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {indicators.map((item) => {
                  const selected = selectedId === item.id;
                  return (
                    <tr
                      key={item.id}
                      className={
                        selected
                          ? "border-t border-[var(--border)] bg-[var(--raised)]"
                          : "border-t border-[var(--border)]"
                      }
                      data-selected={selected ? "true" : "false"}
                    >
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => onSelect(item.id)}
                          aria-pressed={selected}
                          className="inline-flex min-h-11 items-center font-medium text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                        >
                          {item.id}
                        </button>
                        <IndicatorValue value={item.value} />
                      </td>
                      <td className="px-3 py-3 text-[var(--text)]">{item.indicatorTypeLabel}</td>
                      <td className="px-3 py-3 text-[var(--text)]">
                        {item.sourceName}
                        <span className="mt-1 block text-xs text-[var(--muted)]">
                          {item.sourceConnectionLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                        {item.lastSeen}
                      </td>
                      <td className="px-3 py-3 text-[var(--text)]">{item.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {indicators.map((item) => {
              const selected = selectedId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    aria-pressed={selected}
                    className="flex min-h-11 w-full flex-col gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    <span className="font-medium text-[var(--text)]">{item.id}</span>
                    <IndicatorValue value={item.value} />
                    <span className="text-xs text-[var(--muted)]">
                      {item.indicatorTypeLabel} · {item.sourceName} · {item.status}
                    </span>
                    <span className="text-xs text-[var(--muted)]">Last seen {item.lastSeen}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <CatalogPager
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        label="indicators"
        testIdPrefix="indicator-pager"
      />
    </div>
  );
}

export function IndicatorValue({ value }: { value: string }) {
  return (
    <span
      className="block max-w-md truncate text-xs text-[var(--muted)]"
      title={value}
      data-testid="indicator-value"
    >
      {value}
    </span>
  );
}

function Filter({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: IndicatorFilterOption[];
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[var(--text)]" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={selectClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
