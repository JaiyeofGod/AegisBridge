import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/status/StatusBadge";
import type { IntelConfidence, IntelFreshness, ThreatIndicator } from "@/types/threat-intel";

const selectClass =
  "min-h-11 min-w-[140px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

function confidenceTone(confidence: IntelConfidence): "warning" | "accent" | "neutral" {
  if (confidence === "High") return "warning";
  if (confidence === "Medium") return "accent";
  return "neutral";
}

function freshnessTone(freshness: IntelFreshness): "warning" | "success" | "neutral" {
  if (freshness === "Expiring" || freshness === "Stale") return "warning";
  if (freshness === "Current") return "success";
  return "neutral";
}

export function ThreatIndicatorTable({
  indicators,
  selectedId,
  onSelect,
}: {
  indicators: ThreatIndicator[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [confidence, setConfidence] = useState("all");
  const [source, setSource] = useState("all");
  const [freshness, setFreshness] = useState("all");

  const sources = useMemo(
    () => Array.from(new Set(indicators.map((item) => item.source))).sort(),
    [indicators],
  );

  const filtered = indicators.filter((item) => {
    const haystack =
      `${item.indicatorId} ${item.intelId} ${item.value} ${item.type} ${item.source} ${item.relatedCve ?? ""} ${item.relatedAsset ?? ""} ${item.relatedRecord ?? ""}`.toLowerCase();
    const matchesQuery = query.trim().length === 0 || haystack.includes(query.trim().toLowerCase());
    return (
      matchesQuery &&
      (type === "all" || item.type === type) &&
      (confidence === "all" || item.confidence === confidence) &&
      (source === "all" || item.source === source) &&
      (freshness === "all" || item.freshness === freshness)
    );
  });

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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search records…"
            className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          />
        </div>
        <Filter
          id="intel-type"
          label="Indicator type"
          value={type}
          onChange={setType}
          options={["IP", "Domain", "URL", "File hash"]}
        />
        <Filter
          id="intel-confidence"
          label="Confidence"
          value={confidence}
          onChange={setConfidence}
          options={["High", "Medium", "Low"]}
        />
        <Filter
          id="intel-source"
          label="Source"
          value={source}
          onChange={setSource}
          options={sources}
        />
        <Filter
          id="intel-freshness"
          label="Freshness"
          value={freshness}
          onChange={setFreshness}
          options={["Current", "Expiring", "Stale"]}
        />
      </div>

      <div className="hidden overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)] md:block">
        <table className="min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Simulated indicator queue with type, source, confidence, relevance, freshness, and
            related records kept separate
          </caption>
          <thead className="bg-[var(--raised)] text-[var(--muted)]">
            <tr>
              {[
                "Indicator",
                "Value",
                "Type",
                "Source",
                "Confidence",
                "Relevance",
                "First seen",
                "Last seen",
                "Freshness",
                "CVE",
                "Asset",
                "Related",
                "ATT&CK",
                "Status",
              ].map((heading) => (
                <th key={heading} scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-3 py-8 text-[var(--muted)]">
                  No indicators match the current filters. Clear filters to see the sample queue.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      aria-pressed={selectedId === item.id}
                      className="inline-flex min-h-11 flex-col items-start justify-center text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    >
                      <span className="font-medium text-[var(--text)]">{item.indicatorId}</span>
                      <span className="text-xs text-[var(--muted)]">{item.intelId}</span>
                    </button>
                  </td>
                  <td className="px-3 py-3 text-[var(--text)]">{item.value}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.type}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.source}</td>
                  <td className="px-3 py-3">
                    <StatusBadge label={item.confidence} tone={confidenceTone(item.confidence)} />
                  </td>
                  <td className="px-3 py-3 text-[var(--text)]">{item.relevance}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                    {item.firstSeen}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                    {item.lastSeen}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge label={item.freshness} tone={freshnessTone(item.freshness)} />
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.relatedCve ?? "None"}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.relatedAsset ?? "None"}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.relatedRecord ?? "None"}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.attackMapping ?? "None"}</td>
                  <td className="px-3 py-3 text-[var(--text)]">{item.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {filtered.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-pressed={selectedId === item.id}
              className="flex min-h-11 w-full flex-col gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <span className="font-medium text-[var(--text)]">
                {item.indicatorId} · {item.value}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {item.confidence} confidence · {item.freshness} · {item.status}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-[var(--muted)]">
        Showing {filtered.length} of {indicators.length} sample records · Row selection opens record
        details
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
  options: string[];
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
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
