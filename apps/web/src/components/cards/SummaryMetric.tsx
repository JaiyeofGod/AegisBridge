import { StatusBadge } from "@/components/status/StatusBadge";
import { cn } from "@/lib/cn";
import type { OverviewMetric } from "@/types/overview";

const toneBorder = {
  neutral: "border-[var(--border)]",
  critical: "border-[color-mix(in_srgb,var(--critical)_45%,var(--border))]",
  warning: "border-[color-mix(in_srgb,var(--warning)_45%,var(--border))]",
  success: "border-[color-mix(in_srgb,var(--success)_45%,var(--border))]",
  accent: "border-[color-mix(in_srgb,var(--accent)_45%,var(--border))]",
} as const;

export function SummaryMetric({ metric }: { metric: OverviewMetric }) {
  const freshnessLabel =
    metric.freshness === "updating"
      ? "Updating"
      : metric.freshness === "stale"
        ? "Stale"
        : metric.freshness === "error"
          ? "Unavailable"
          : metric.freshness === "empty"
            ? "No data"
            : "Current";

  return (
    <article
      className={cn(
        "flex min-h-[140px] flex-col justify-between rounded-[var(--radius-panel)] border bg-[var(--raised)] p-4",
        toneBorder[metric.tone],
      )}
      aria-label={`${metric.label}: ${metric.primaryValue}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-[var(--muted)]">{metric.label}</h3>
        <StatusBadge
          label={freshnessLabel}
          tone={metric.tone === "neutral" ? "neutral" : metric.tone}
        />
      </div>
      <p className="font-heading mt-3 text-3xl font-bold tracking-tight text-[var(--text)]">
        {metric.freshness === "updating" ? "Updating…" : metric.primaryValue}
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        <span className="font-semibold text-[var(--text)]">{metric.secondaryValue}</span>{" "}
        {metric.secondaryLabel}
      </p>
      <p className="sr-only">{metric.semantics}</p>
    </article>
  );
}
