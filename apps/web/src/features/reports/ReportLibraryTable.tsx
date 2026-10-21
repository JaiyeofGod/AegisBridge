import { StatusBadge } from "@/components/status/StatusBadge";
import { reportStatusTone, type ReportDefinitionView } from "@/features/reports/mapReports";

export type ReportTableFilters = {
  search: string;
  status: string;
  reportType: string;
};

export type ReportFilterOption = { value: string; label: string };

const selectClass =
  "min-h-11 min-w-[140px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const statuses: ReportFilterOption[] = [
  { value: "ready", label: "Ready" },
  { value: "review", label: "Review" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

export function ReportLibraryTable({
  reports,
  total,
  selectedId,
  onSelect,
  filters,
  onFiltersChange,
  reportTypeOptions,
  emptyLabel,
  showFilters = true,
}: {
  reports: ReportDefinitionView[];
  total: number;
  selectedId: string;
  onSelect: (id: string) => void;
  filters: ReportTableFilters;
  onFiltersChange: (filters: ReportTableFilters) => void;
  reportTypeOptions: ReportFilterOption[];
  emptyLabel: string;
  showFilters?: boolean;
}) {
  return (
    <div className="space-y-4">
      {showFilters ? (
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
          <div className="min-w-[200px] flex-1">
            <label
              className="mb-2 block text-sm font-medium text-[var(--text)]"
              htmlFor="report-search"
            >
              Search records
            </label>
            <input
              id="report-search"
              type="search"
              value={filters.search}
              onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
              placeholder="Search records…"
              className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            />
          </div>
          <Filter
            id="report-status"
            label="Status"
            value={filters.status}
            onChange={(status) => onFiltersChange({ ...filters, status })}
            options={statuses}
          />
          <Filter
            id="report-type"
            label="Report type"
            value={filters.reportType}
            onChange={(reportType) => onFiltersChange({ ...filters, reportType })}
            options={reportTypeOptions}
          />
        </div>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Report definitions with type, owner, last run, schedule, status, and format
          </caption>
          <thead className="text-[var(--muted)]">
            <tr>
              {["Report", "Type", "Owner", "Last run", "Schedule", "Status", "Format"].map(
                (heading) => (
                  <th key={heading} scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-[var(--muted)]">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              reports.map((item) => (
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
                  <td className="px-3 py-3 text-[var(--muted)]">{item.reportTypeLabel}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.owner}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                    {item.lastRunAt}
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">
                    {item.scheduleStateLabel}
                    {item.scheduleState === "schedule_defined" ? (
                      <span className="mt-1 block text-xs">
                        {item.scheduleLabel} · cadence only
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge label={item.statusLabel} tone={reportStatusTone(item.status)} />
                  </td>
                  <td className="px-3 py-3 text-[var(--text)]">{item.formatLabel}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {reports.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">{emptyLabel}</li>
        ) : (
          reports.map((item) => (
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
                  {item.statusLabel} · {item.formatLabel} · {item.scheduleStateLabel}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>

      <p className="text-xs text-[var(--muted)]">
        Showing {reports.length} of {total} stored definitions · Row selection opens definition
        details · Schedule cadence is not a running worker
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
  options: ReportFilterOption[];
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
