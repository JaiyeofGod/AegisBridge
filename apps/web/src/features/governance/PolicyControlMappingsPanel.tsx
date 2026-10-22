import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { invalidateGovernanceWrites } from "@/features/governance/governance-mutations";
import { ApiError } from "@/services/api-client";
import type { ControlListItem, PolicyMappedControl } from "@/services/api-types";
import { fetchGovernanceControls } from "@/services/governance";
import { linkPolicyControl, unlinkPolicyControl } from "@/services/policies";

type Props = {
  policyId: string;
  mappings: PolicyMappedControl[];
  canManage: boolean;
  onOpenControl?: (controlId: string) => void;
};

function frameworkLabel(item: {
  framework_code: string | null;
  framework_version: string | null;
}): string {
  if (!item.framework_code) return "Framework not stored";
  return `${item.framework_code}${item.framework_version ? ` ${item.framework_version}` : ""}`;
}

function controlOptionLabel(item: ControlListItem): string {
  const framework = frameworkLabel(item);
  return `${item.id} · ${item.control_code} · ${framework}`;
}

export function PolicyControlMappingsPanel({
  policyId,
  mappings,
  canManage,
  onOpenControl,
}: Props) {
  const queryClient = useQueryClient();
  const { handleAccountUnauthorized } = useAuthActions();
  const [showLinker, setShowLinker] = useState(false);
  const [filter, setFilter] = useState("");
  const [selectedControlId, setSelectedControlId] = useState("");
  const [pendingUnlinkId, setPendingUnlinkId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: ["governance", "controls"],
    queryFn: () => fetchGovernanceControls(1, 50),
    enabled: canManage && showLinker,
    retry: false,
    staleTime: 30_000,
  });

  const mappedIds = useMemo(() => new Set(mappings.map((item) => item.id)), [mappings]);

  const filteredControls = useMemo(() => {
    const items = catalogQuery.data?.items ?? [];
    const needle = filter.trim().toLowerCase();
    return items.filter((item) => {
      if (!needle) return true;
      const haystack = [
        item.id,
        item.control_code,
        item.title,
        item.framework_code ?? "",
        item.framework_version ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [catalogQuery.data?.items, filter]);

  async function onMutationError(error: unknown) {
    setSuccessMessage(null);
    if (await handleAccountUnauthorized(error)) {
      return;
    }
    if (error instanceof ApiError) {
      if (error.status === 403) {
        setErrorMessage("You do not have permission to change policy-control mappings.");
        return;
      }
      if (error.status === 404) {
        setErrorMessage("Policy, control, or mapping was not found.");
        await invalidateGovernanceWrites(queryClient, { policyId });
        return;
      }
      if (error.status === 409) {
        setErrorMessage("The mapping changed since you loaded it. Refresh and try again.");
        await invalidateGovernanceWrites(queryClient, { policyId });
        return;
      }
      if (error.status >= 500) {
        setErrorMessage("Unable to update the policy-control mapping right now.");
        return;
      }
      setErrorMessage(error.message || "Unable to update the policy-control mapping.");
      return;
    }
    setErrorMessage("Unable to update the policy-control mapping right now.");
  }

  const link = useMutation({
    mutationFn: async () => {
      if (!selectedControlId) {
        throw new ApiError("Select a control to link.", 422, "validation_error");
      }
      return linkPolicyControl(policyId, selectedControlId);
    },
    onSuccess: async (result) => {
      setSuccessMessage(`Linked ${result.control_id} to ${result.policy_id}.`);
      setErrorMessage(null);
      setShowLinker(false);
      setFilter("");
      setSelectedControlId("");
      await invalidateGovernanceWrites(queryClient, {
        policyId: result.policy_id,
        controlId: result.control_id,
      });
    },
    onError: onMutationError,
  });

  const unlink = useMutation({
    mutationFn: async (controlId: string) => unlinkPolicyControl(policyId, controlId),
    onSuccess: async (result) => {
      setPendingUnlinkId(null);
      setSuccessMessage(`Removed mapping to ${result.control_id}.`);
      setErrorMessage(null);
      await invalidateGovernanceWrites(queryClient, {
        policyId: result.policy_id,
        controlId: result.control_id,
      });
    },
    onError: onMutationError,
  });

  return (
    <div className="space-y-4" data-testid="policy-control-mappings">
      <p className="text-xs text-[var(--muted)]">
        Traceability: Policy → mapped Control → control tests → evidence. Mappings store the
        relationship only. Licensed CIS safeguard prose is not included
        {mappings.some((item) => item.licensed_text_included)
          ? " (API unexpectedly marked licensed text present)."
          : "."}
      </p>

      {mappings.length === 0 ? (
        <p className="text-sm text-[var(--muted)]" data-testid="policy-mappings-empty">
          No controls are mapped to this policy yet.
        </p>
      ) : (
        <ul className="space-y-3" data-testid="policy-mappings-list">
          {mappings.map((item) => (
            <li
              key={item.id}
              className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-3"
              data-testid={`policy-mapping-${item.id}`}
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
                  {onOpenControl ? (
                    <Button
                      type="button"
                      variant="secondary"
                      data-testid={`policy-mapping-open-${item.id}`}
                      onClick={() => onOpenControl(item.id)}
                    >
                      Open control
                    </Button>
                  ) : null}
                  {canManage ? (
                    <Button
                      type="button"
                      variant="secondary"
                      data-testid={`policy-mapping-unlink-${item.id}`}
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
                  className="mt-3 space-y-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-3"
                  data-testid="policy-mapping-unlink-confirm"
                >
                  <p className="text-sm text-[var(--text)]">Remove this control mapping?</p>
                  <p className="text-xs text-[var(--muted)]">
                    The policy remains. The control remains. Control tests and evidence remain. Only
                    the relationship is removed.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      data-testid="policy-mapping-unlink-confirm-submit"
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
      )}

      {canManage ? (
        showLinker ? (
          <div
            className="space-y-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-3"
            data-testid="policy-mapping-link-form"
          >
            <label className="block text-xs text-[var(--muted)]">
              Filter controls
              <input
                className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                data-testid="policy-mapping-control-filter"
                placeholder="Search by id, code, title, framework…"
              />
            </label>
            {catalogQuery.isPending ? (
              <p className="text-sm text-[var(--muted)]">Loading control catalog…</p>
            ) : null}
            {catalogQuery.isError ? (
              <p className="text-sm text-[var(--danger)]">Control catalog could not be loaded.</p>
            ) : null}
            {catalogQuery.isSuccess ? (
              <label className="block text-xs text-[var(--muted)]">
                Existing control
                <select
                  className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                  value={selectedControlId}
                  onChange={(event) => setSelectedControlId(event.target.value)}
                  data-testid="policy-mapping-control-select"
                >
                  <option value="">Select control…</option>
                  {filteredControls.map((item) => {
                    const alreadyMapped = mappedIds.has(item.id);
                    return (
                      <option key={item.id} value={item.id} disabled={alreadyMapped}>
                        {controlOptionLabel(item)}
                        {alreadyMapped ? " (already mapped)" : ""}
                        {` — ${item.title}`}
                      </option>
                    );
                  })}
                </select>
              </label>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                data-testid="policy-mapping-link-submit"
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
                  setFilter("");
                  setSelectedControlId("");
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
            data-testid="policy-mapping-add"
            onClick={() => {
              setShowLinker(true);
              setErrorMessage(null);
            }}
          >
            Add control
          </Button>
        )
      ) : (
        <p className="text-xs text-[var(--muted)]" data-testid="policy-mapping-readonly">
          Linking controls requires the policy.manage permission.
        </p>
      )}

      {successMessage ? (
        <p
          className="text-sm text-[var(--accent)]"
          data-testid="policy-mapping-success"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-[var(--danger)]" data-testid="policy-mapping-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
