import { StatusBadge } from "@/components/status/StatusBadge";
import type { DatasetView } from "@/features/reports/mapReports";

export type DatasetTableFilters = {
  search: string;
  status: string;
  domain: string;
  verificationStatus: string;
  publicationYear: string;
};

export type DatasetFilterOption = { value: string; label: string };

const selectClass =
  "min-h-11 min-w-[140px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const statuses: DatasetFilterOption[] = [
  { value: "not_downloaded", label: "Not downloaded" },
  { value: "candidate", label: "Candidate" },
  { value: "reviewed", label: "Reviewed" },
  { value: "verification_required", label: "Verification required" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const verificationStatuses: DatasetFilterOption[] = [
  { value: "not_reviewed", label: "Not reviewed" },
  { value: "verification_required", label: "Verification required" },
  { value: "reviewed", label: "Reviewed" },
];

export function DatasetRegistryTable({
  datasets,
  total,
  selectedId,
  onSelect,
  filters,
  onFiltersChange,
  domainOptions,
  yearOptions,
  emptyLabel,
}: {
  datasets: DatasetView[];
  total: number;
  selectedId: string;
  onSelect: (id: string) => void;
  filters: DatasetTableFilters;
  onFiltersChange: (filters: DatasetTableFilters) => void;
  domainOptions: DatasetFilterOption[];
  yearOptions: DatasetFilterOption[];
  emptyLabel: string;
}) {
  return (
    <div className="space-y-4" data-testid="report-datasets">
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
        <div className="min-w-[200px] flex-1">
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="dataset-search"
          >
            Search records
          </label>
          <input
            id="dataset-search"
            type="search"
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            placeholder="Search datasets…"
            className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          />
        </div>
        <Filter
          id="dataset-status"
          label="Lifecycle status"
          value={filters.status}
          onChange={(status) => onFiltersChange({ ...filters, status })}
          options={statuses}
        />
        <Filter
          id="dataset-verification"
          label="Verification"
          value={filters.verificationStatus}
          onChange={(verificationStatus) => onFiltersChange({ ...filters, verificationStatus })}
          options={verificationStatuses}
        />
        <Filter
          id="dataset-domain"
          label="Domain"
          value={filters.domain}
          onChange={(domain) => onFiltersChange({ ...filters, domain })}
          options={domainOptions}
        />
        <Filter
          id="dataset-year"
          label="Year"
          value={filters.publicationYear}
          onChange={(publicationYear) => onFiltersChange({ ...filters, publicationYear })}
          options={yearOptions}
        />
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Dataset registry with year, domain, license, lifecycle status, verification, and file
            count
          </caption>
          <thead className="text-[var(--muted)]">
            <tr>
              {[
                "Dataset",
                "Year",
                "Domain",
                "License",
                "Lifecycle",
                "Verification",
                "Files",
                "Versions",
              ].map((heading) => (
                <th key={heading} scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datasets.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-[var(--muted)]">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              datasets.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      aria-pressed={selectedId === item.id}
                      onClick={() => onSelect(item.id)}
                      className="inline-flex min-h-11 flex-col items-start justify-center text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    >
                      <span className="font-medium text-[var(--text)]">{item.name}</span>
                      <span className="text-xs text-[var(--muted)]">{item.id}</span>
                    </button>
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.publicationYear}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.domain}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.licenseLabel}</td>
                  <td className="px-3 py-3">
                    <StatusBadge
                      label={item.statusLabel}
                      tone={item.status === "not_downloaded" ? "warning" : "neutral"}
                    />
                  </td>
                  <td className="px-3 py-3 text-[var(--text)]">{item.verificationLabel}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.fileCount}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.versionCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {datasets.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">{emptyLabel}</li>
        ) : (
          datasets.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={selectedId === item.id}
                onClick={() => onSelect(item.id)}
                className="flex min-h-11 w-full flex-col gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                <span className="font-medium text-[var(--text)]">
                  {item.id} · {item.name}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {item.publicationYear} · {item.statusLabel} · {item.verificationLabel}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>

      <p className="text-xs text-[var(--muted)]">
        Showing {datasets.length} of {total} registry entries · not_downloaded is registry metadata
        only, not local availability · Verification stays separate from lifecycle status
      </p>
    </div>
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
  options: DatasetFilterOption[];
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
