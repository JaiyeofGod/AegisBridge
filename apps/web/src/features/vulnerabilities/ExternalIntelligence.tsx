import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/buttons/Button";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { formatCalendarDate, formatTimestamp } from "@/lib/format";
import { ApiError } from "@/services/api-client";
import { refreshVulnerabilityIntelligence } from "@/services/vulnerabilities";
import type {
  VulnerabilityIntelligenceRefreshResult,
  VulnerabilityIntelligenceSourceResult,
} from "@/services/api-types";
import type { VulnerabilityFinding } from "@/types/vulnerability";

type Props = {
  finding: VulnerabilityFinding;
  canManage: boolean;
};

function formatUnit(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value * 100);
}

function ordinalSuffix(text: string): string {
  const integer = Math.trunc(Math.abs(Number(text)));
  if (!text.includes(".") && integer % 100 >= 11 && integer % 100 <= 13) return "th";
  const last = Number(text.slice(-1));
  if (last === 1) return "st";
  if (last === 2) return "nd";
  if (last === 3) return "rd";
  return "th";
}

function formatEpssProbability(value: number): string {
  return `${formatUnit(value)}%`;
}

function formatEpssPercentile(value: number): string {
  const text = formatUnit(value);
  return `${text}${ordinalSuffix(text)} percentile`;
}

function sourceLabel(source: string): string {
  if (source === "NVD") return "NVD";
  if (source === "CISA_KEV") return "CISA KEV";
  if (source === "FIRST_EPSS") return "FIRST EPSS";
  return source;
}

function statusLabel(status: string): string {
  if (status === "updated") return "Updated";
  if (status === "unavailable") return "Unavailable";
  if (status === "no_data") return "No data";
  return status;
}

function joinNames(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function refreshMessages(sources: VulnerabilityIntelligenceSourceResult[]): string[] {
  const updated = sources.filter((item) => item.status === "updated");
  const unavailable = sources.filter((item) => item.status === "unavailable");
  const noData = sources.filter((item) => item.status === "no_data");
  if (sources.length > 0 && unavailable.length === sources.length) {
    return [
      "External vulnerability intelligence could not be refreshed. Existing stored intelligence was preserved.",
    ];
  }
  const lines: string[] = [];
  if (updated.length > 0 && unavailable.length > 0) {
    const updatedNames = joinNames(updated.map((item) => sourceLabel(item.source)));
    const unavailableNames = joinNames(unavailable.map((item) => sourceLabel(item.source)));
    const verb = unavailable.length === 1 ? "was" : "were";
    lines.push(
      `${updatedNames} updated. ${unavailableNames} ${verb} unavailable; previous ${unavailableNames} data was preserved.`,
    );
  }
  for (const item of noData) {
    lines.push(`${sourceLabel(item.source)} returned no data for this CVE.`);
  }
  return lines;
}

function refreshErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return "You do not have permission to refresh vulnerability intelligence.";
    }
    if (error.status === 404) return "This vulnerability no longer exists.";
    if (error.status === 422) {
      return "External intelligence refresh is available only for vulnerabilities with a valid CVE identifier.";
    }
    if (error.status >= 500) return "Unable to refresh vulnerability intelligence right now.";
  }
  return "Unable to refresh vulnerability intelligence right now.";
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-[var(--text)]">{value}</dd>
    </div>
  );
}

function WhenPresent({
  label,
  value,
  kind,
}: {
  label: string;
  value: string | null | undefined;
  kind: "timestamp" | "date";
}) {
  if (!value) return null;
  const text = kind === "date" ? formatCalendarDate(value) : formatTimestamp(value);
  return <Fact label={label} value={text} />;
}

export function ExternalIntelligence({ finding, canManage }: Props) {
  const queryClient = useQueryClient();
  const { handleAccountUnauthorized } = useAuthActions();
  const hasCve = Boolean(finding.cve);
  const refresh = useMutation({
    mutationFn: () => refreshVulnerabilityIntelligence(finding.findingId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vulnerabilities"] });
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: async (error) => {
      await handleAccountUnauthorized(error);
    },
  });
  const result = refresh.data;

  return (
    <section aria-labelledby="external-intelligence-heading" data-testid="external-intelligence">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="external-intelligence-heading"
            className="font-heading text-base font-bold text-[var(--text)]"
          >
            External vulnerability intelligence
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            NVD, CISA KEV, and FIRST EPSS stay separate. They are not combined into a score.
          </p>
        </div>
        {canManage && hasCve ? (
          <Button
            type="button"
            variant="secondary"
            disabled={refresh.isPending}
            data-testid="refresh-intelligence"
            onClick={() => refresh.mutate()}
          >
            {refresh.isPending ? "Refreshing intelligence…" : "Refresh intelligence"}
          </Button>
        ) : null}
      </div>

      {refresh.isPending ? (
        <p className="mt-3 text-sm text-[var(--muted)]" role="status">
          Refreshing intelligence…
        </p>
      ) : null}

      {!hasCve ? (
        <p className="mt-3 text-sm text-[var(--muted)]" data-testid="intelligence-no-cve">
          External CVE intelligence is unavailable because this vulnerability has no CVE identifier.
        </p>
      ) : null}

      {refresh.isError ? (
        <p
          className="mt-3 text-sm text-[var(--critical)]"
          role="alert"
          data-testid="intelligence-refresh-error"
        >
          {refreshErrorMessage(refresh.error)}
        </p>
      ) : null}

      {result ? <RefreshResult result={result} /> : null}

      <div className="mt-4 grid grid-cols-1 gap-3">
        <NvdCard finding={finding} />
        <KevCard finding={finding} />
        <EpssCard finding={finding} />
      </div>
    </section>
  );
}

function RefreshResult({ result }: { result: VulnerabilityIntelligenceRefreshResult }) {
  const allUnavailable =
    result.sources.length > 0 && result.sources.every((item) => item.status === "unavailable");
  const messages = refreshMessages(result.sources);
  return (
    <div className="mt-3 space-y-2" role="status" data-testid="intelligence-refresh-result">
      {allUnavailable ? null : (
        <p className="text-sm font-semibold text-[var(--text)]">Intelligence refresh completed</p>
      )}
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {result.sources.map((item) => (
          <div key={item.source}>
            <dt className="text-xs text-[var(--muted)]">{sourceLabel(item.source)}</dt>
            <dd className="text-sm text-[var(--text)]">{statusLabel(item.status)}</dd>
          </div>
        ))}
      </dl>
      {messages.map((message) => (
        <p key={message} className="text-sm text-[var(--muted)]">
          {message}
        </p>
      ))}
      <p className="text-xs text-[var(--muted)]">
        Last manual refresh: {formatTimestamp(result.fetched_at)}. This is the time of the refresh
        attempt. It does not mean every source succeeded.
      </p>
    </div>
  );
}

function NvdCard({ finding }: { finding: VulnerabilityFinding }) {
  return (
    <article
      className="rounded-[var(--radius-control)] bg-[var(--raised)] px-3 py-3"
      aria-labelledby="intel-nvd-heading"
      data-testid="intel-nvd"
    >
      <h4 id="intel-nvd-heading" className="font-semibold text-[var(--text)]">
        NVD
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
        CVSS measures technical severity. It does not estimate the probability of exploitation.
      </p>
      {finding.cve ? (
        <dl className="mt-3 space-y-2 text-sm">
          <Fact label="CVE" value={finding.cve} />
          <Fact
            label="CVSS base score"
            value={finding.cvss == null ? "Not recorded" : String(finding.cvss)}
          />
          <Fact label="CVSS version" value={finding.cvssVersion || "Not recorded"} />
          <Fact label="CVSS severity" value={finding.severity} />
          {finding.cvssVector ? <Fact label="Vector" value={finding.cvssVector} /> : null}
          {finding.cveSummary ? <Fact label="Summary" value={finding.cveSummary} /> : null}
          <WhenPresent
            label="Published"
            value={finding.intelligence?.nvd?.publishedAt}
            kind="timestamp"
          />
          <WhenPresent
            label="Last modified by source"
            value={finding.intelligence?.nvd?.sourceModifiedAt}
            kind="timestamp"
          />
          <WhenPresent
            label="Last fetched by AegisBridge"
            value={finding.intelligence?.nvd?.fetchedAt}
            kind="timestamp"
          />
        </dl>
      ) : (
        <p className="mt-3 text-sm text-[var(--text)]">Not available · No CVE</p>
      )}
    </article>
  );
}

function KevCard({ finding }: { finding: VulnerabilityFinding }) {
  return (
    <article
      className="rounded-[var(--radius-control)] bg-[var(--raised)] px-3 py-3"
      aria-labelledby="intel-kev-heading"
      data-testid="intel-kev"
    >
      <h4 id="intel-kev-heading" className="font-semibold text-[var(--text)]">
        CISA KEV
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
        KEV means this CVE is listed in CISA&apos;s Known Exploited Vulnerabilities catalog.
      </p>
      {finding.cve ? (
        <dl className="mt-3 space-y-2 text-sm">
          <Fact label="KEV" value={finding.kev === "KEV listed" ? "Listed" : "Not listed"} />
          <WhenPresent label="Date added" value={finding.kevDateAdded} kind="date" />
          {finding.knownRansomwareUse ? (
            <Fact
              label="Known ransomware campaign use"
              value={finding.knownRansomwareUse.replaceAll("_", " ")}
            />
          ) : null}
          {finding.intelligence?.kev?.vendorProject ? (
            <Fact label="Vendor / Project" value={finding.intelligence.kev.vendorProject} />
          ) : null}
          {finding.intelligence?.kev?.product ? (
            <Fact label="Product" value={finding.intelligence.kev.product} />
          ) : null}
          {finding.intelligence?.kev?.requiredAction ? (
            <div>
              <dt className="text-[var(--muted)]">Required action</dt>
              <dd className="mt-1 max-w-prose whitespace-pre-wrap text-[var(--text)]">
                {finding.intelligence.kev.requiredAction}
              </dd>
            </div>
          ) : null}
          <WhenPresent label="CISA due date" value={finding.intelligence?.kev?.dueOn} kind="date" />
          <WhenPresent
            label="Last checked by AegisBridge"
            value={finding.intelligence?.kev?.checkedAt}
            kind="timestamp"
          />
        </dl>
      ) : (
        <p className="mt-3 text-sm text-[var(--text)]">Not available · No CVE</p>
      )}
    </article>
  );
}

function EpssCard({ finding }: { finding: VulnerabilityFinding }) {
  return (
    <article
      className="rounded-[var(--radius-control)] bg-[var(--raised)] px-3 py-3"
      aria-labelledby="intel-epss-heading"
      data-testid="intel-epss"
    >
      <h4 id="intel-epss-heading" className="font-semibold text-[var(--text)]">
        FIRST EPSS
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
        EPSS estimates the probability of exploitation activity. It is not a severity score or
        confirmation of exploitation.
      </p>
      {finding.cve ? (
        <dl className="mt-3 space-y-2 text-sm">
          <Fact
            label="EPSS probability"
            value={finding.epss == null ? "Not recorded" : formatEpssProbability(finding.epss)}
          />
          <Fact
            label="Percentile"
            value={
              finding.epssPercentile == null
                ? "Not recorded"
                : formatEpssPercentile(finding.epssPercentile)
            }
          />
          <WhenPresent
            label="Observation date"
            value={finding.epssObservedOn ?? finding.intelligence?.epss?.observedOn}
            kind="date"
          />
          <WhenPresent
            label="Last fetched by AegisBridge"
            value={finding.intelligence?.epss?.fetchedAt}
            kind="timestamp"
          />
        </dl>
      ) : (
        <p className="mt-3 text-sm text-[var(--text)]">Not available · No CVE</p>
      )}
    </article>
  );
}
