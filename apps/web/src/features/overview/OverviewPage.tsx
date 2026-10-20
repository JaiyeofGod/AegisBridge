import { useQuery } from "@tanstack/react-query";

import { SummaryMetric } from "@/components/cards/SummaryMetric";
import { Panel } from "@/components/cards/Panel";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { SimulatedDataBanner } from "@/components/feedback/SimulatedDataBanner";
import { AppShell } from "@/components/navigation/AppShell";
import { PageContainer } from "@/components/navigation/PageContainer";
import { PageHeader } from "@/components/navigation/PageHeader";
import { StatusBadge } from "@/components/status/StatusBadge";
import { StaleDataIndicator } from "@/components/status/StaleDataIndicator";
import { SEEDED_DATA_LABEL, SEEDED_DATA_NOTE } from "@/features/data-origin";
import { useOverviewData } from "@/features/overview/useOverviewData";
import { formatTimestamp } from "@/lib/format";
import { fetchHealthLive } from "@/services/health";

export function OverviewPage() {
  const overview = useOverviewData();
  const lastSuccessfulAt = overview.data?.lastSuccessfulFetchAt;
  const healthQuery = useQuery({
    queryKey: ["health", "live"],
    queryFn: fetchHealthLive,
    retry: false,
    staleTime: 30_000,
  });

  return (
    <AppShell environmentLabel={overview.data?.environmentLabel ?? "Development · Seeded"}>
      <PageContainer data-testid="overview-page">
        <PageHeader
          title="Overview"
          description="Priority actions, exposure, incidents, control effectiveness, and telemetry coverage for the fictional AegisBridge Technologies program."
          actions={
            <div className="flex flex-col items-end gap-2.5">
              <SimulatedDataBanner message={SEEDED_DATA_NOTE} />
              {lastSuccessfulAt ? (
                <p className="text-xs text-[var(--muted)]" data-testid="last-successful-fetch">
                  Last successful update: {formatTimestamp(lastSuccessfulAt)}
                </p>
              ) : null}
              <p className="text-xs text-[var(--muted)]" data-testid="api-health-status">
                API health:{" "}
                {healthQuery.isLoading
                  ? "Checking…"
                  : healthQuery.isError
                    ? "Unavailable (dev connectivity)"
                    : `${healthQuery.data?.status ?? "unknown"} · ${healthQuery.data?.service ?? "api"}`}
              </p>
            </div>
          }
        />

        {overview.isPending ? <LoadingState label="Updating" rows={4} /> : null}

        {overview.isError ? (
          <ErrorState
            title="Overview data unavailable"
            description="The development overview API did not respond. Retry to load the seeded records. Fixture counts are not substituted."
            lastSuccessfulAt={lastSuccessfulAt}
            onRetry={() => void overview.refetch()}
          />
        ) : null}

        {overview.isSuccess && overview.isFetching ? (
          <div className="mb-6">
            <StaleDataIndicator
              message="Refreshing development overview"
              lastSuccessfulAt={lastSuccessfulAt}
            />
          </div>
        ) : null}

        {overview.isSuccess && overview.data ? (
          <div className="space-y-8">
            <section aria-labelledby="security-overview-heading">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2
                  id="security-overview-heading"
                  className="font-heading text-xl font-bold text-[var(--text)]"
                >
                  Security Overview
                </h2>
                <StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {overview.data.metrics.map((metric) => (
                  <SummaryMetric key={metric.id} metric={metric} />
                ))}
              </div>
              <p className="mt-4 text-xs text-[var(--muted)]">
                Metrics are scoped independently. There is no aggregate security score.
              </p>
            </section>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
              <Panel
                title="My Work"
                description="Open work stored in the development database."
                className="h-full"
              >
                <ul className="space-y-3">
                  {overview.data.myWork.length === 0 ? (
                    <li className="text-sm text-[var(--muted)]">No open work items are stored.</li>
                  ) : null}
                  {overview.data.myWork.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-3 py-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="leading-snug font-medium text-[var(--text)]">{item.title}</p>
                        <p className="text-xs leading-snug text-[var(--muted)]">{item.meta}</p>
                      </div>
                      <div className="shrink-0 pt-0.5">
                        <StatusBadge label={item.statusLabel} tone={item.statusTone} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel
                title="Security highlights"
                description="Notes derived from stored development records."
                className="h-full"
              >
                <ul className="space-y-3">
                  {overview.data.securityHighlights.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-[var(--radius-control)] border border-transparent bg-[var(--raised)] px-3 py-3"
                    >
                      <p className="leading-snug font-medium text-[var(--text)]">{item.title}</p>
                      <p className="mt-1 text-sm leading-snug text-[var(--muted)]">{item.detail}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            <Panel title="Executive" description="Narrative context for leadership review.">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {overview.data.executiveNotes.map((note) => (
                  <article
                    key={note.id}
                    className="flex min-h-[132px] flex-col rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-5"
                  >
                    <h3 className="font-heading text-base leading-snug text-[var(--text)]">
                      {note.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                      {note.detail}
                    </p>
                  </article>
                ))}
              </div>
            </Panel>
          </div>
        ) : null}
      </PageContainer>
    </AppShell>
  );
}
