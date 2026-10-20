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
import { useOverviewData } from "@/features/overview/useOverviewData";
import { fetchHealthLive } from "@/services/health";

export function OverviewPage() {
  const overview = useOverviewData();
  const healthQuery = useQuery({
    queryKey: ["health", "live"],
    queryFn: fetchHealthLive,
    retry: false,
    staleTime: 30_000,
  });

  return (
    <AppShell environmentLabel={overview.data.environmentLabel}>
      <PageContainer data-testid="overview-page">
        <PageHeader
          title="Overview"
          description="Priority actions, exposure, incidents, control effectiveness, and telemetry coverage for the fictional AegisBridge Technologies program."
          actions={
            <div className="flex flex-col items-end gap-2">
              <SimulatedDataBanner />
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

        {overview.state === "loading" ? <LoadingState label="Updating" rows={4} /> : null}

        {overview.state === "error" ? (
          <ErrorState
            title="Overview data unavailable"
            description="The simulated overview source failed to load. Retry to restore the last known demo snapshot."
            lastSuccessfulAt={overview.data.lastSuccessfulFetchAt}
            onRetry={overview.reload}
          />
        ) : null}

        {overview.state === "ready" ? (
          <div className="space-y-6">
            <section aria-labelledby="security-overview-heading">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2
                  id="security-overview-heading"
                  className="font-heading text-xl font-bold text-[var(--text)]"
                >
                  Security Overview
                </h2>
                <StatusBadge label="SIMULATED" tone="warning" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {overview.data.metrics.map((metric) => (
                  <SummaryMetric key={metric.id} metric={metric} />
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Metrics are scoped independently. There is no aggregate security score.
              </p>
            </section>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Panel
                title="My Work"
                description="Queued analyst actions from the simulated program backlog."
              >
                <ul className="space-y-3">
                  {overview.data.myWork.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-3"
                    >
                      <div>
                        <p className="font-medium text-[var(--text)]">{item.title}</p>
                        <p className="text-xs text-[var(--muted)]">{item.meta}</p>
                      </div>
                      <StatusBadge label={item.statusLabel} tone={item.statusTone} />
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel
                title="Security highlights"
                description="Freshness and priority context for the current demo snapshot."
              >
                <ul className="space-y-3">
                  {overview.data.securityHighlights.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-[var(--radius-control)] bg-[var(--raised)] p-3"
                    >
                      <p className="font-medium text-[var(--text)]">{item.title}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            <Panel title="Executive" description="Narrative context for leadership review.">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {overview.data.executiveNotes.map((note) => (
                  <article
                    key={note.id}
                    className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-4"
                  >
                    <h3 className="font-heading text-base text-[var(--text)]">{note.title}</h3>
                    <p className="mt-2 text-sm text-[var(--muted)]">{note.detail}</p>
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
