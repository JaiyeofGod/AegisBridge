import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { Panel } from "@/components/cards/Panel";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { StatusBadge } from "@/components/status/StatusBadge";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { invalidateGovernanceWrites } from "@/features/governance/governance-mutations";
import { PolicyControlMappingsPanel } from "@/features/governance/PolicyControlMappingsPanel";
import {
  allowedPolicyTransitions,
  type PolicyTransitionOption,
} from "@/features/governance/policyTransitions";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import { ApiError } from "@/services/api-client";
import type {
  PolicyCreate,
  PolicyDetail,
  PolicyLifecycleStatus,
  PolicyVersionCreate,
  PolicyVersionUpdate,
} from "@/services/api-types";
import {
  acknowledgePolicy,
  createPolicy,
  createPolicyVersion,
  fetchPolicies,
  fetchPolicy,
  fetchPolicyVersion,
  transitionPolicy,
  updatePolicyVersion,
} from "@/services/policies";

type Props = {
  canRead: boolean;
  canManage: boolean;
  canApprove: boolean;
  onOpenControl?: (controlId: string) => void;
};

function titleCaseStatus(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status: string): "neutral" | "warning" | "success" | "critical" {
  if (status === "published") return "success";
  if (status === "retired") return "critical";
  if (status === "in_review" || status === "approved") return "warning";
  return "neutral";
}

export function PolicyManagementPanel({ canRead, canManage, canApprove, onOpenControl }: Props) {
  const queryClient = useQueryClient();
  const { handleAccountUnauthorized } = useAuthActions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedVersionLabel, setSelectedVersionLabel] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const [createTitle, setCreateTitle] = useState("");
  const [createContent, setCreateContent] = useState("Draft policy content.");
  const [createVersionLabel, setCreateVersionLabel] = useState("0.1");
  const [createChangeSummary, setCreateChangeSummary] = useState("");

  const [draftContent, setDraftContent] = useState("");
  const [draftChangeSummary, setDraftChangeSummary] = useState("");
  const [newVersionLabel, setNewVersionLabel] = useState("");
  const [newVersionContent, setNewVersionContent] = useState("");
  const [newVersionChangeSummary, setNewVersionChangeSummary] = useState("");
  const [showNewVersionForm, setShowNewVersionForm] = useState(false);

  const [pendingTransition, setPendingTransition] = useState<PolicyTransitionOption | null>(null);
  const [publishVersionLabel, setPublishVersionLabel] = useState("");

  const listQuery = useQuery({
    queryKey: ["policies", "list"],
    queryFn: () => fetchPolicies(1, 50),
    enabled: canRead,
    retry: false,
    staleTime: 15_000,
  });

  const items = listQuery.data?.items ?? [];
  const activeId =
    selectedId && items.some((item) => item.id === selectedId)
      ? selectedId
      : (items[0]?.id ?? null);

  const detailQuery = useQuery({
    queryKey: ["policies", "detail", activeId],
    queryFn: () => fetchPolicy(activeId!),
    enabled: canRead && Boolean(activeId),
    retry: false,
    staleTime: 10_000,
  });

  const detail = detailQuery.data ?? null;
  const versionLabel =
    selectedVersionLabel &&
    detail?.versions.some((version) => version.version_label === selectedVersionLabel)
      ? selectedVersionLabel
      : (detail?.current_version ??
        detail?.versions.find((version) => version.status === "draft")?.version_label ??
        detail?.versions[0]?.version_label ??
        null);

  const versionQuery = useQuery({
    queryKey: ["policies", "version", activeId, versionLabel],
    queryFn: () => fetchPolicyVersion(activeId!, versionLabel!),
    enabled: canRead && Boolean(activeId) && Boolean(versionLabel),
    retry: false,
    staleTime: 10_000,
  });

  const version = versionQuery.data ?? null;
  const versionEditable = version?.status === "draft" && canManage;

  useEffect(() => {
    setDraftContent(version?.content ?? "");
    setDraftChangeSummary(version?.change_summary ?? "");
    setConflict(false);
    setErrorMessage(null);
  }, [version?.version_label, version?.updated_at, version?.content, version?.change_summary]);

  useEffect(() => {
    setPendingTransition(null);
    setShowNewVersionForm(false);
    setErrorMessage(null);
    setConflict(false);
  }, [activeId]);

  const transitions = useMemo(
    () => (detail ? allowedPolicyTransitions(detail.status, canManage, canApprove) : []),
    [detail, canManage, canApprove],
  );

  const draftVersions = detail?.versions.filter((item) => item.status === "draft") ?? [];

  async function refreshAfterWrite(policyId: string, nextDetail?: PolicyDetail) {
    if (nextDetail) {
      queryClient.setQueryData(["policies", "detail", policyId], nextDetail);
    }
    await invalidateGovernanceWrites(queryClient, { policyId });
    await listQuery.refetch();
    await detailQuery.refetch();
    if (versionLabel) {
      await versionQuery.refetch();
    }
  }

  async function onMutationError(error: unknown) {
    setSuccessMessage(null);
    if (await handleAccountUnauthorized(error)) {
      return;
    }
    if (error instanceof ApiError) {
      if (error.status === 403) {
        setErrorMessage("You do not have permission for this policy action.");
        return;
      }
      if (error.status === 404) {
        setErrorMessage("Policy or version was not found.");
        return;
      }
      if (error.status === 409) {
        setConflict(true);
        setErrorMessage(error.message || "This policy/version changed since you loaded it.");
        return;
      }
      if (error.status === 422) {
        setErrorMessage(error.message || "Policy values are invalid.");
        return;
      }
      setErrorMessage(error.message || "Policy action failed.");
      return;
    }
    setErrorMessage("Policy action failed.");
  }

  const create = useMutation({
    mutationFn: async () => {
      const body: PolicyCreate = {
        title: createTitle.trim(),
        initial_version_label: createVersionLabel.trim() || "0.1",
        initial_content: createContent.trim() || "Draft policy content.",
      };
      if (createChangeSummary.trim()) {
        body.change_summary = createChangeSummary.trim();
      }
      return createPolicy(body);
    },
    onSuccess: async (created) => {
      setCreateTitle("");
      setCreateContent("Draft policy content.");
      setCreateVersionLabel("0.1");
      setCreateChangeSummary("");
      setSelectedId(created.id);
      setSelectedVersionLabel(created.versions[0]?.version_label ?? null);
      setSuccessMessage(`Policy ${created.id} created as draft.`);
      setErrorMessage(null);
      await refreshAfterWrite(created.id, created);
    },
    onError: onMutationError,
  });

  const saveDraft = useMutation({
    mutationFn: async () => {
      if (!activeId || !version) {
        throw new ApiError("No draft version selected.", 422, "validation_error");
      }
      const body: PolicyVersionUpdate = {};
      if (draftContent !== version.content) {
        body.content = draftContent;
      }
      if (draftChangeSummary !== (version.change_summary ?? "")) {
        body.change_summary = draftChangeSummary.trim() === "" ? null : draftChangeSummary.trim();
      }
      if (Object.keys(body).length === 0) {
        throw new ApiError("No draft changes to save.", 400, "no_changes");
      }
      if (version.updated_at) {
        body.expected_updated_at = version.updated_at;
      }
      return updatePolicyVersion(activeId, version.version_label, body);
    },
    onSuccess: async (updated) => {
      setSuccessMessage(`Draft version ${updated.version_label} saved.`);
      setErrorMessage(null);
      setConflict(false);
      queryClient.setQueryData(["policies", "version", activeId, updated.version_label], updated);
      if (activeId) {
        await refreshAfterWrite(activeId);
      }
    },
    onError: onMutationError,
  });

  const addVersion = useMutation({
    mutationFn: async () => {
      if (!activeId) {
        throw new ApiError("No policy selected.", 422, "validation_error");
      }
      const body: PolicyVersionCreate = {
        version_label: newVersionLabel.trim(),
        content: newVersionContent.trim(),
      };
      if (newVersionChangeSummary.trim()) {
        body.change_summary = newVersionChangeSummary.trim();
      }
      return createPolicyVersion(activeId, body);
    },
    onSuccess: async (createdVersion) => {
      setShowNewVersionForm(false);
      setNewVersionLabel("");
      setNewVersionContent("");
      setNewVersionChangeSummary("");
      setSelectedVersionLabel(createdVersion.version_label);
      setSuccessMessage(`Draft version ${createdVersion.version_label} created.`);
      setErrorMessage(null);
      if (activeId) {
        await refreshAfterWrite(activeId);
      }
    },
    onError: onMutationError,
  });

  const runTransition = useMutation({
    mutationFn: async (option: PolicyTransitionOption) => {
      if (!detail || !activeId) {
        throw new ApiError("No policy selected.", 422, "validation_error");
      }
      const body: {
        to_status: PolicyLifecycleStatus;
        version_label?: string;
        expected_updated_at?: string;
      } = { to_status: option.toStatus };
      if (option.requiresVersion) {
        const label = publishVersionLabel.trim();
        if (!label) {
          throw new ApiError("Select a draft version to publish.", 422, "validation_error");
        }
        body.version_label = label;
      }
      if (detail.updated_at) {
        body.expected_updated_at = detail.updated_at;
      }
      return transitionPolicy(activeId, body);
    },
    onSuccess: async (updated) => {
      setPendingTransition(null);
      setPublishVersionLabel("");
      setSuccessMessage(`Policy ${updated.id} is now ${titleCaseStatus(updated.status)}.`);
      setErrorMessage(null);
      setConflict(false);
      if (updated.current_version) {
        setSelectedVersionLabel(updated.current_version);
      }
      await refreshAfterWrite(updated.id, updated);
    },
    onError: onMutationError,
  });

  const acknowledge = useMutation({
    mutationFn: async () => {
      if (!activeId) {
        throw new ApiError("No policy selected.", 422, "validation_error");
      }
      return acknowledgePolicy(activeId);
    },
    onSuccess: async (result) => {
      setSuccessMessage(
        result.already_acknowledged
          ? `Already acknowledged version ${result.version_label}.`
          : `Acknowledged version ${result.version_label}.`,
      );
      setErrorMessage(null);
      if (activeId) {
        await refreshAfterWrite(activeId);
      }
    },
    onError: onMutationError,
  });

  if (!canRead) {
    return (
      <p className="text-sm text-[var(--muted)]" data-testid="policies-readonly">
        Viewing policies requires the policy.read permission.
      </p>
    );
  }

  return (
    <div className="space-y-6" data-testid="policy-management-panel">
      <p className="text-sm text-[var(--muted)]" data-testid="policy-workflow-copy">
        Workflow: metadata → draft version → review → approval → publication → acknowledgement.
        Published versions are immutable historical records. External e-signature, email, and rich
        document generation are not available.
      </p>

      {canManage ? (
        <Panel
          title="Create policy"
          description="Server assigns POL-NNNN. Initial version is a draft."
        >
          <div className="space-y-3" data-testid="policy-create-form">
            <label className="block text-xs text-[var(--muted)]">
              Title
              <input
                className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                value={createTitle}
                onChange={(event) => setCreateTitle(event.target.value)}
                data-testid="policy-create-title"
              />
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Initial version label
              <input
                className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                value={createVersionLabel}
                onChange={(event) => setCreateVersionLabel(event.target.value)}
                data-testid="policy-create-version-label"
              />
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Initial content
              <textarea
                className="mt-1 block min-h-24 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                value={createContent}
                onChange={(event) => setCreateContent(event.target.value)}
                data-testid="policy-create-content"
              />
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Change summary (optional)
              <input
                className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                value={createChangeSummary}
                onChange={(event) => setCreateChangeSummary(event.target.value)}
                data-testid="policy-create-change-summary"
              />
            </label>
            <p className="text-xs text-[var(--muted)]">
              Description, effective date, and review date fields are not stored by the current API.
            </p>
            <Button
              type="button"
              data-testid="policy-create"
              disabled={create.isPending || createTitle.trim().length === 0}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Creating…" : "Create policy"}
            </Button>
          </div>
        </Panel>
      ) : (
        <p className="text-xs text-[var(--muted)]" data-testid="policy-create-readonly">
          Creating policies requires the policy.manage permission.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <Panel title="Policies" description="Select a policy to manage versions and lifecycle.">
          {listQuery.isPending ? <LoadingState label="Loading policies" rows={3} /> : null}
          {listQuery.isError ? (
            <ErrorState
              title="Policies unavailable"
              description="The policy list could not be loaded."
              onRetry={() => void listQuery.refetch()}
            />
          ) : null}
          {listQuery.isSuccess ? (
            <ul className="space-y-2" data-testid="policies-list">
              {items.length === 0 ? (
                <li className="text-sm text-[var(--muted)]">No policy records are stored.</li>
              ) : (
                items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded-[var(--radius-control)] border px-3 py-3 text-left transition",
                        item.id === activeId
                          ? "border-[var(--accent)] bg-[var(--raised)]"
                          : "border-[var(--border)] bg-[var(--canvas)] hover:border-[var(--accent)]",
                      )}
                      data-testid={`policy-select-${item.id}`}
                      onClick={() => {
                        setSelectedId(item.id);
                        setSelectedVersionLabel(null);
                        setSuccessMessage(null);
                        setErrorMessage(null);
                      }}
                    >
                      <p className="text-sm font-medium text-[var(--text)]">
                        {item.id} · {item.title}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {titleCaseStatus(item.status)}
                        {item.current_version ? ` · current ${item.current_version}` : ""}
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </Panel>

        <div className="space-y-4">
          {!activeId ? (
            <Panel title="Policy detail" description="Select a policy to continue.">
              <p className="text-sm text-[var(--muted)]">No policy selected.</p>
            </Panel>
          ) : (
            <>
              {detailQuery.isPending ? <LoadingState label="Loading policy" rows={4} /> : null}
              {detailQuery.isError ? (
                <ErrorState
                  title="Policy unavailable"
                  description="The selected policy could not be loaded."
                  onRetry={() => void detailQuery.refetch()}
                />
              ) : null}
              {detail ? (
                <>
                  <Panel
                    title={`${detail.id} · ${detail.title}`}
                    description="Policy metadata and acknowledgement state."
                    action={
                      <StatusBadge
                        label={titleCaseStatus(detail.status)}
                        tone={statusTone(detail.status)}
                      />
                    }
                  >
                    <dl className="grid gap-2 text-sm sm:grid-cols-2" data-testid="policy-detail">
                      <div>
                        <dt className="text-xs text-[var(--muted)]">Owner</dt>
                        <dd>
                          {detail.owner
                            ? `${detail.owner.id} · ${detail.owner.display_name}`
                            : "Unassigned"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--muted)]">Current version</dt>
                        <dd data-testid="policy-current-version">
                          {detail.current_version ?? "None published"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--muted)]">Updated</dt>
                        <dd>{detail.updated_at ? formatTimestamp(detail.updated_at) : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--muted)]">Created</dt>
                        <dd>{detail.created_at ? formatTimestamp(detail.created_at) : "—"}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-[var(--muted)]">Acknowledgements</dt>
                        <dd data-testid="policy-ack-summary">
                          Count {detail.acknowledgements.acknowledgement_count}
                          {detail.acknowledgements.current_user_acknowledged
                            ? ` · You acknowledged${
                                detail.acknowledgements.current_user_acknowledged_at
                                  ? ` ${formatTimestamp(detail.acknowledgements.current_user_acknowledged_at)}`
                                  : ""
                              }`
                            : " · You have not acknowledged the current published version"}
                        </dd>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {detail.acknowledgements.semantics}
                        </p>
                      </div>
                    </dl>
                    <p className="mt-3 text-xs text-[var(--muted)]">{detail.semantics}</p>

                    {detail.status === "published" &&
                    !detail.acknowledgements.current_user_acknowledged ? (
                      <div className="mt-4">
                        <Button
                          type="button"
                          data-testid="policy-acknowledge"
                          disabled={acknowledge.isPending}
                          onClick={() => acknowledge.mutate()}
                        >
                          {acknowledge.isPending ? "Acknowledging…" : "Acknowledge current version"}
                        </Button>
                      </div>
                    ) : null}
                    {detail.acknowledgements.current_user_acknowledged ? (
                      <p
                        className="mt-4 text-sm text-[var(--accent)]"
                        data-testid="policy-acknowledged-state"
                      >
                        Acknowledged
                        {detail.acknowledgements.current_user_acknowledged_at
                          ? ` · ${formatTimestamp(detail.acknowledgements.current_user_acknowledged_at)}`
                          : ""}
                      </p>
                    ) : null}
                  </Panel>

                  <Panel
                    title="Mapped controls"
                    description="Policy → Control → Test → Evidence. Relationship-only; no duplicated framework text."
                  >
                    <PolicyControlMappingsPanel
                      policyId={detail.id}
                      mappings={detail.control_mappings}
                      canManage={canManage}
                      onOpenControl={onOpenControl}
                    />
                  </Panel>

                  <Panel
                    title="Version history"
                    description="Published and superseded versions are read-only historical records."
                  >
                    <div className="overflow-x-auto" data-testid="policy-version-history">
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-xs text-[var(--muted)]">
                          <tr>
                            <th className="px-2 py-2">Version</th>
                            <th className="px-2 py-2">Status</th>
                            <th className="px-2 py-2">Updated</th>
                            <th className="px-2 py-2">Current</th>
                            <th className="px-2 py-2">Acks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.versions.map((item) => (
                            <tr
                              key={item.version_label}
                              className={cn(
                                "border-t border-[var(--border)]",
                                item.version_label === versionLabel ? "bg-[var(--raised)]" : "",
                              )}
                            >
                              <td className="px-2 py-2">
                                <button
                                  type="button"
                                  className="text-[var(--accent)] underline-offset-2 hover:underline"
                                  data-testid={`policy-version-select-${item.version_label}`}
                                  onClick={() => setSelectedVersionLabel(item.version_label)}
                                >
                                  {item.version_label}
                                </button>
                              </td>
                              <td className="px-2 py-2">{titleCaseStatus(item.status)}</td>
                              <td className="px-2 py-2">
                                {item.updated_at ? formatTimestamp(item.updated_at) : "—"}
                              </td>
                              <td className="px-2 py-2">{item.is_current ? "Yes" : "No"}</td>
                              <td className="px-2 py-2">{item.acknowledgement_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {canManage ? (
                      <div className="mt-4">
                        {showNewVersionForm ? (
                          <div className="space-y-3" data-testid="policy-new-version-form">
                            <label className="block text-xs text-[var(--muted)]">
                              Version label
                              <input
                                className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                                value={newVersionLabel}
                                onChange={(event) => setNewVersionLabel(event.target.value)}
                                data-testid="policy-new-version-label"
                              />
                            </label>
                            <label className="block text-xs text-[var(--muted)]">
                              Content
                              <textarea
                                className="mt-1 block min-h-24 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                                value={newVersionContent}
                                onChange={(event) => setNewVersionContent(event.target.value)}
                                data-testid="policy-new-version-content"
                              />
                            </label>
                            <label className="block text-xs text-[var(--muted)]">
                              Change summary
                              <input
                                className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                                value={newVersionChangeSummary}
                                onChange={(event) => setNewVersionChangeSummary(event.target.value)}
                                data-testid="policy-new-version-change-summary"
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                data-testid="policy-new-version-submit"
                                disabled={
                                  addVersion.isPending ||
                                  newVersionLabel.trim().length === 0 ||
                                  newVersionContent.trim().length === 0
                                }
                                onClick={() => addVersion.mutate()}
                              >
                                {addVersion.isPending ? "Creating…" : "Create draft version"}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setShowNewVersionForm(false)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            data-testid="policy-new-version"
                            onClick={() => setShowNewVersionForm(true)}
                          >
                            Create new draft version
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </Panel>

                  <Panel
                    title={version ? `Version ${version.version_label}` : "Selected version"}
                    description={
                      versionEditable
                        ? "Edit draft content. CSRF-protected save uses expected_updated_at."
                        : "Historical and published versions are read-only."
                    }
                    action={
                      version ? (
                        <StatusBadge
                          label={
                            version.is_current
                              ? "Current"
                              : version.status === "draft"
                                ? "Draft"
                                : "Historical"
                          }
                          tone={version.is_current ? "success" : "neutral"}
                        />
                      ) : null
                    }
                  >
                    {versionQuery.isPending ? (
                      <LoadingState label="Loading version" rows={3} />
                    ) : null}
                    {version ? (
                      <div className="space-y-3" data-testid="policy-version-detail">
                        {!versionEditable ? (
                          <p
                            className="text-xs text-[var(--muted)]"
                            data-testid="policy-version-readonly"
                          >
                            This version is {titleCaseStatus(version.status)} and cannot be edited.
                            Create a new draft version to change content.
                          </p>
                        ) : null}
                        <label className="block text-xs text-[var(--muted)]">
                          Content
                          <textarea
                            className="mt-1 block min-h-32 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                            value={versionEditable ? draftContent : version.content}
                            readOnly={!versionEditable}
                            onChange={(event) => setDraftContent(event.target.value)}
                            data-testid="policy-version-content"
                          />
                        </label>
                        <label className="block text-xs text-[var(--muted)]">
                          Change summary
                          <input
                            className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                            value={
                              versionEditable ? draftChangeSummary : (version.change_summary ?? "")
                            }
                            readOnly={!versionEditable}
                            onChange={(event) => setDraftChangeSummary(event.target.value)}
                            data-testid="policy-version-change-summary"
                          />
                        </label>
                        {versionEditable ? (
                          <Button
                            type="button"
                            data-testid="policy-version-save"
                            disabled={saveDraft.isPending}
                            onClick={() => saveDraft.mutate()}
                          >
                            {saveDraft.isPending ? "Saving…" : "Save draft"}
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--muted)]">No version selected.</p>
                    )}
                  </Panel>

                  <Panel
                    title="Lifecycle"
                    description="Transitions follow server rules. Approval and publish require policy.approve."
                  >
                    {transitions.length === 0 ? (
                      <p
                        className="text-sm text-[var(--muted)]"
                        data-testid="policy-lifecycle-empty"
                      >
                        No lifecycle actions are available for your permissions and this status.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2" data-testid="policy-lifecycle-actions">
                        {transitions.map((option) => (
                          <Button
                            key={`${option.toStatus}-${option.label}`}
                            type="button"
                            variant={option.needsConfirm ? "secondary" : undefined}
                            data-testid={`policy-transition-${option.toStatus}`}
                            disabled={runTransition.isPending}
                            onClick={() => {
                              setErrorMessage(null);
                              if (option.needsConfirm) {
                                setPendingTransition(option);
                                setPublishVersionLabel(
                                  draftVersions[0]?.version_label ?? version?.version_label ?? "",
                                );
                                return;
                              }
                              runTransition.mutate(option);
                            }}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    )}

                    {pendingTransition?.needsConfirm === "publish" ? (
                      <div
                        className="mt-4 space-y-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-3"
                        data-testid="policy-publish-confirm"
                      >
                        <p className="text-sm text-[var(--text)]">
                          Publish version {publishVersionLabel || "…"}? It becomes the current
                          published version. Any prior published version becomes historical and
                          immutable.
                        </p>
                        <label className="block text-xs text-[var(--muted)]">
                          Draft version to publish
                          <select
                            className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                            value={publishVersionLabel}
                            onChange={(event) => setPublishVersionLabel(event.target.value)}
                            data-testid="policy-publish-version"
                          >
                            <option value="">Select draft…</option>
                            {draftVersions.map((item) => (
                              <option key={item.version_label} value={item.version_label}>
                                {item.version_label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            data-testid="policy-publish-confirm-submit"
                            disabled={
                              runTransition.isPending || publishVersionLabel.trim().length === 0
                            }
                            onClick={() => runTransition.mutate(pendingTransition)}
                          >
                            {runTransition.isPending
                              ? "Publishing…"
                              : `Publish version ${publishVersionLabel}`}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setPendingTransition(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {pendingTransition?.needsConfirm === "retire" ? (
                      <div
                        className="mt-4 space-y-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-3"
                        data-testid="policy-retire-confirm"
                      >
                        <p className="text-sm text-[var(--text)]">
                          Retire this policy? History and acknowledgements are preserved. Versions
                          are not deleted.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            data-testid="policy-retire-confirm-submit"
                            disabled={runTransition.isPending}
                            onClick={() => runTransition.mutate(pendingTransition)}
                          >
                            {runTransition.isPending ? "Retiring…" : "Confirm retire"}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setPendingTransition(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </Panel>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {conflict ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="policy-conflict">
          <p className="text-sm text-[var(--danger)]">
            This policy/version changed since you loaded it.
          </p>
          <Button
            type="button"
            variant="secondary"
            data-testid="policy-reload"
            onClick={() => {
              setConflict(false);
              void detailQuery.refetch();
              void versionQuery.refetch();
            }}
          >
            Reload
          </Button>
        </div>
      ) : null}
      {successMessage ? (
        <p className="text-sm text-[var(--accent)]" data-testid="policy-success" role="status">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-[var(--danger)]" data-testid="policy-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
