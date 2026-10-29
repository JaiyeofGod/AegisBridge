import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/buttons/Button";
import { CatalogPager } from "@/components/navigation/CatalogPager";
import { useAuthActions } from "@/features/auth/useAuthSession";
import {
  CONTROL_IMPLEMENTATION_STATUSES,
  CONTROL_SELECTOR_PAGE_SIZE,
  totalPages,
} from "@/features/governance/catalogConstants";
import { invalidateRiskControlMappings } from "@/features/risk/risk-mutations";
import { cn } from "@/lib/cn";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { ApiError } from "@/services/api-client";
import type {
  ControlImplementationStatusValue,
  ControlListItem,
  ControlListQuery,
  RiskMappedControl,
} from "@/services/api-types";
import { fetchGovernanceControls } from "@/services/governance";
import { linkRiskControl, unlinkRiskControl } from "@/services/risks";

type Props = {
  riskId: string;
  mappings: RiskMappedControl[];
  canManage: boolean;
  status: "loading" | "error" | "ready";
  onRetry?: () => void;
};

const MAPPING_NOTE =
  "Mapping a control to a risk does not change the risk score or prove the control is effective.";

function frameworkLabel(item: {
  framework_code: string | null;
  framework_name?: string | null;
  framework_version: string | null;
}): string {
  if (!item.framework_code && !item.framework_name) return "Framework not stored";
  const name = item.framework_name ? `${item.framework_name} ` : "";
  const code = item.framework_code ?? "";
  const version = item.framework_version ? ` ${item.framework_version}` : "";
  return `${name}${code}${version}`.trim();
}

function controlOptionLabel(item: ControlListItem): string {
  return `${item.id} · ${item.control_code} · ${frameworkLabel(item)}`;
}

export function RiskControlMappingsPanel({ riskId, mappings, canManage, status, onRetry }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { handleAccountUnauthorized } = useAuthActions();
  const [showLinker, setShowLinker] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [framework, setFramework] = useState("");
  const debouncedFramework = useDebouncedValue(framework, 300);
  const [implementationStatus, setImplementationStatus] = useState<
    ControlImplementationStatusValue | ""
  >("");
  const [page, setPage] = useState(1);
  const [selectedControlId, setSelectedControlId] = useState("");
  const [pendingUnlinkId, setPendingUnlinkId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectorQuery = useMemo<ControlListQuery>(
    () => ({
      page,
      pageSize: CONTROL_SELECTOR_PAGE_SIZE,
      q: debouncedSearch.trim() || undefined,
      framework: debouncedFramework.trim() || undefined,
      implementationStatus: implementationStatus || undefined,
      sort: "id",
      direction: "asc",
    }),
    [page, debouncedSearch, debouncedFramework, implementationStatus],
  );

  const catalogQuery = useQuery({
    queryKey: ["governance", "controls", "selector", "risk", riskId, selectorQuery],
    queryFn: () => fetchGovernanceControls(selectorQuery),
    enabled: canManage && showLinker,
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, debouncedFramework, implementationStatus]);

  useEffect(() => {
    if (!catalogQuery.data) return;
    const pages = totalPages(catalogQuery.data.total, CONTROL_SELECTOR_PAGE_SIZE);
    if (page > pages) setPage(pages);
  }, [catalogQuery.data, page]);

  const mappedIds = useMemo(() => new Set(mappings.map((item) => item.id)), [mappings]);
  const catalogItems = catalogQuery.data?.items ?? [];
  const catalogTotal = catalogQuery.data?.total ?? 0;
  const hasSearch = Boolean(
    debouncedSearch.trim() || debouncedFramework.trim() || implementationStatus,
  );

  async function onMutationError(error: unknown) {
    setSuccessMessage(null);
    if (await handleAccountUnauthorized(error)) {
      return;
    }
    if (error instanceof ApiError) {
      if (error.status === 403) {
        setErrorMessage("You do not have permission to change risk-control mappings.");
        return;
      }
      if (error.status === 404) {
        setErrorMessage("Risk, control, or mapping was not found.");
        await invalidateRiskControlMappings(queryClient, { riskId });
        return;
      }
      if (error.status === 409) {
        setErrorMessage("The mapping changed since you loaded it. Refresh and try again.");
        await invalidateRiskControlMappings(queryClient, { riskId });
        return;
      }
      if (error.status >= 500) {
        setErrorMessage("Unable to update the risk-control mapping right now.");
        return;
      }
      setErrorMessage(error.message || "Unable to update the risk-control mapping.");
      return;
    }
    setErrorMessage("Unable to update the risk-control mapping right now.");
  }

  const link = useMutation({
    mutationFn: async () => {
      if (!selectedControlId) {
        throw new ApiError("Select a control to link.", 422, "validation_error");
      }
      return linkRiskControl(riskId, selectedControlId);
    },
    onSuccess: async (result) => {
      setSuccessMessage(`Linked ${result.control_id} to ${result.risk_id}.`);
      setErrorMessage(null);
      setShowLinker(false);
      setSearchInput("");
      setFramework("");
      setImplementationStatus("");
      setSelectedControlId("");
      setPage(1);
      await invalidateRiskControlMappings(queryClient, {
        riskId: result.risk_id,
        controlId: result.control_id,
      });
    },
    onError: onMutationError,
  });

  const unlink = useMutation({
    mutationFn: async (controlId: string) => unlinkRiskControl(riskId, controlId),
    onSuccess: async (result) => {
      setPendingUnlinkId(null);
      setSuccessMessage(`Removed mapping to ${result.control_id}.`);
      setErrorMessage(null);
      await invalidateRiskControlMappings(queryClient, {
        riskId: result.risk_id,
        controlId: result.control_id,
      });
    },
    onError: onMutationError,
  });

  return (
    <section className="space-y-4" aria-labelledby="risk-mapped-controls-heading">
      <h3 id="risk-mapped-controls-heading" className="text-sm font-medium text-[var(--text)]">
        Mapped Controls
      </h3>
      <p className="text-xs text-[var(--muted)]" data-testid="risk-control-mapping-semantics">
        {MAPPING_NOTE} Traceability is Risk → mapped Control → control tests → evidence. Licensed
        CIS safeguard prose is not included.
      </p>

      {status === "loading" ? (
        <p className="text-sm text-[var(--muted)]" data-testid="risk-control-mappings-loading">
          Loading mapped controls…
        </p>
      ) : null}
      {status === "error" ? (
        <div className="space-y-2" data-testid="risk-control-mappings-load-error">
          <p className="text-sm text-[var(--danger)]" role="alert">
            Mapped controls could not be loaded.
          </p>
          {onRetry ? (
            <Button type="button" variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
      {status === "ready" && mappings.length === 0 ? (
        <p className="text-sm text-[var(--muted)]" data-testid="risk-control-mappings-empty">
          No controls are mapped to this risk yet.
        </p>
      ) : null}
      {status === "ready" && mappings.length > 0 ? (
        <ul className="space-y-3" data-testid="risk-control-mappings-list">
          {mappings.map((item) => (
            <li
              key={item.id}
              className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-3"
              data-testid={`risk-control-mapping-${item.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">
                    {item.id} · {item.control_code}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text)]">{item.title}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {frameworkLabel(item)}
                    {item.implementation_status
                      ? ` · ${item.implementation_status.replaceAll("_", " ")}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    licensed_text_included=
                    {item.licensed_text_included ? "true" : "false"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    data-testid={`risk-control-mapping-open-${item.id}`}
                    onClick={() => navigate("/governance", { state: { focusControlId: item.id } })}
                  >
                    Open control
                  </Button>
                  {canManage ? (
                    <Button
                      type="button"
                      variant="secondary"
                      aria-label={`Remove mapping for ${item.id}`}
                      data-testid={`risk-control-mapping-unlink-${item.id}`}
                      onClick={() => {
                        setErrorMessage(null);
                        setPendingUnlinkId(item.id);
                      }}
                    >
                      Remove mapping
                    </Button>
                  ) : null}
                </div>
              </div>

              {pendingUnlinkId === item.id ? (
                <div
                  className="motion-dialog mt-3 space-y-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-3"
                  role="dialog"
                  aria-labelledby={`risk-unlink-title-${item.id}`}
                  data-testid="risk-control-mapping-unlink-confirm"
                >
                  <p id={`risk-unlink-title-${item.id}`} className="text-sm text-[var(--text)]">
                    Remove this control mapping?
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    This removes only the relationship. The risk, control, tests, evidence, and
                    treatment data remain unchanged.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      data-testid="risk-control-mapping-unlink-confirm-submit"
                      disabled={unlink.isPending}
                      onClick={() => unlink.mutate(item.id)}
                    >
                      {unlink.isPending ? "Removing…" : "Confirm remove mapping"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setPendingUnlinkId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {canManage ? (
        showLinker ? (
          <div
            className="space-y-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-3"
            data-testid="risk-control-mapping-link-form"
          >
            <label className="block text-xs text-[var(--muted)]">
              Search controls
              <div className="mt-1 flex gap-2">
                <input
                  className="block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value);
                    setSelectedControlId("");
                  }}
                  data-testid="risk-control-mapping-control-filter"
                  placeholder="Search by id, code, title, framework…"
                />
                <Button
                  type="button"
                  variant="secondary"
                  aria-label="Clear control search"
                  data-testid="risk-control-mapping-control-filter-clear"
                  disabled={searchInput.length === 0}
                  onClick={() => {
                    setSearchInput("");
                    setSelectedControlId("");
                  }}
                >
                  Clear
                </Button>
              </div>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-[var(--muted)]">
                Framework code
                <input
                  className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                  value={framework}
                  onChange={(event) => {
                    setFramework(event.target.value);
                    setSelectedControlId("");
                  }}
                  data-testid="risk-control-mapping-framework-filter"
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Implementation status
                <select
                  className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                  value={implementationStatus}
                  onChange={(event) => {
                    setImplementationStatus(
                      event.target.value as ControlImplementationStatusValue | "",
                    );
                    setSelectedControlId("");
                  }}
                  data-testid="risk-control-mapping-status-filter"
                >
                  <option value="">Any status</option>
                  {CONTROL_IMPLEMENTATION_STATUSES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {catalogQuery.isPending && !catalogQuery.data ? (
              <p className="text-sm text-[var(--muted)]">Loading control catalog…</p>
            ) : null}
            {catalogQuery.isFetching && catalogQuery.data ? (
              <p
                className="text-xs text-[var(--muted)]"
                data-testid="risk-control-mapping-catalog-updating"
              >
                Updating results…
              </p>
            ) : null}
            {catalogQuery.isError ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                Control catalog could not be loaded.
              </p>
            ) : null}
            {catalogQuery.isSuccess || catalogQuery.data ? (
              <>
                <fieldset data-testid="risk-control-mapping-control-select">
                  <legend className="text-xs text-[var(--muted)]">Existing control</legend>
                  {catalogItems.length === 0 ? (
                    <p
                      className="mt-2 text-sm text-[var(--muted)]"
                      data-testid="risk-control-mapping-catalog-empty"
                    >
                      {hasSearch
                        ? "No controls match the current search."
                        : "No controls are available."}
                    </p>
                  ) : (
                    <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                      {catalogItems.map((item) => {
                        const alreadyMapped = mappedIds.has(item.id);
                        const selected = selectedControlId === item.id;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              disabled={alreadyMapped}
                              aria-pressed={selected}
                              aria-label={
                                alreadyMapped
                                  ? `${controlOptionLabel(item)} already mapped`
                                  : controlOptionLabel(item)
                              }
                              data-testid={`risk-control-mapping-control-option-${item.id}`}
                              className={cn(
                                "w-full rounded-[var(--radius-control)] border px-3 py-2 text-left text-sm transition",
                                alreadyMapped
                                  ? "cursor-not-allowed border-[var(--border)] bg-[var(--canvas)] text-[var(--muted)] opacity-70"
                                  : selected
                                    ? "border-[var(--accent)] bg-[var(--canvas)] text-[var(--text)]"
                                    : "border-[var(--border)] bg-[var(--canvas)] text-[var(--text)] hover:border-[var(--accent)]",
                              )}
                              onClick={() => {
                                if (!alreadyMapped) setSelectedControlId(item.id);
                              }}
                            >
                              <span className="font-medium">{controlOptionLabel(item)}</span>
                              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                                {item.title}
                                {alreadyMapped ? " (already mapped)" : ""}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </fieldset>
                <CatalogPager
                  page={page}
                  pageSize={CONTROL_SELECTOR_PAGE_SIZE}
                  total={catalogTotal}
                  onPageChange={(next) => {
                    setPage(next);
                    setSelectedControlId("");
                  }}
                  label="controls"
                  testIdPrefix="risk-control-mapping-catalog-pager"
                />
              </>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                data-testid="risk-control-mapping-link-submit"
                disabled={link.isPending || selectedControlId.trim().length === 0}
                onClick={() => link.mutate()}
              >
                {link.isPending ? "Linking…" : "Link control"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowLinker(false);
                  setSearchInput("");
                  setFramework("");
                  setImplementationStatus("");
                  setSelectedControlId("");
                  setPage(1);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            data-testid="risk-control-mapping-add"
            onClick={() => {
              setShowLinker(true);
              setErrorMessage(null);
            }}
          >
            Add control
          </Button>
        )
      ) : (
        <p className="text-xs text-[var(--muted)]" data-testid="risk-control-mapping-readonly">
          Linking controls requires the risk.manage permission.
        </p>
      )}

      {successMessage ? (
        <p
          className="motion-status-enter text-sm text-[var(--accent)]"
          data-testid="risk-control-mapping-success"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          className="text-sm text-[var(--danger)]"
          data-testid="risk-control-mapping-error"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
