import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { ApiError } from "@/services/api-client";
import { updateVulnerabilityRemediation } from "@/services/vulnerabilities";
import type { RemediationStatusValue, VulnerabilityRemediationUpdate } from "@/services/api-types";

const STATUSES = [
  "open",
  "in_progress",
  "complete",
  "deferred",
  "cancelled",
  "accepted",
] as const satisfies readonly RemediationStatusValue[];

type Props = {
  vulnerabilityId: string;
  assetId: string | null;
  status: string | null;
  title: string | null;
  dueOn: string | null;
  ownerLabel: string;
  updatedAt: string | null;
  canManage: boolean;
};

function normalizeStatus(value: string | null): RemediationStatusValue {
  const lower = (value ?? "").toLowerCase().replaceAll(" ", "_");
  return (STATUSES as readonly string[]).includes(lower)
    ? (lower as RemediationStatusValue)
    : "open";
}

export function RemediationEditor({
  vulnerabilityId,
  assetId,
  status,
  title,
  dueOn,
  ownerLabel,
  updatedAt,
  canManage,
}: Props) {
  const queryClient = useQueryClient();
  const { handleAccountUnauthorized } = useAuthActions();
  const [draftStatus, setDraftStatus] = useState(normalizeStatus(status));
  const [draftTitle, setDraftTitle] = useState(title ?? "");
  const [draftDueOn, setDraftDueOn] = useState(dueOn ?? "");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    setDraftStatus(normalizeStatus(status));
    setDraftTitle(title ?? "");
    setDraftDueOn(dueOn ?? "");
    setConflict(false);
    setErrorMessage(null);
  }, [vulnerabilityId, assetId, status, title, dueOn, updatedAt]);

  function restore() {
    setDraftStatus(normalizeStatus(status));
    setDraftTitle(title ?? "");
    setDraftDueOn(dueOn ?? "");
    setErrorMessage(null);
    setSuccessMessage(null);
    setConflict(false);
  }

  const save = useMutation({
    mutationFn: async () => {
      const patch: VulnerabilityRemediationUpdate = {};
      if (draftStatus !== normalizeStatus(status)) {
        patch.status = draftStatus;
      }
      if (draftTitle !== (title ?? "")) {
        patch.title = draftTitle;
      }
      const nextDue = draftDueOn.trim() === "" ? null : draftDueOn.trim();
      if (nextDue !== (dueOn ?? null)) {
        patch.due_on = nextDue;
      }
      if (Object.keys(patch).length === 0) {
        throw new ApiError("No remediation changes to save.", 400, "no_changes");
      }
      // Selector only — never a reassignment of the asset relationship.
      if (assetId) {
        patch.asset_id = assetId;
      }
      if (updatedAt) {
        patch.expected_updated_at = updatedAt;
      }
      return updateVulnerabilityRemediation(vulnerabilityId, patch);
    },
    onSuccess: async (detail) => {
      setSuccessMessage("Remediation updated.");
      setErrorMessage(null);
      setConflict(false);
      queryClient.setQueryData(["vulnerabilities", "detail", vulnerabilityId], detail);
      await queryClient.invalidateQueries({ queryKey: ["vulnerabilities"] });
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: async (error) => {
      setSuccessMessage(null);
      if (await handleAccountUnauthorized(error)) {
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setConflict(true);
          setErrorMessage("This remediation changed since you loaded it.");
          return;
        }
        if (error.status === 403) {
          setErrorMessage("You do not have permission to update remediation.");
          return;
        }
        if (error.status === 404) {
          setErrorMessage("This vulnerability was not found.");
          return;
        }
        if (error.status === 422) {
          setErrorMessage(error.message || "Remediation values are invalid.");
          return;
        }
        if (error.code === "no_changes") {
          setErrorMessage("No remediation changes to save.");
          return;
        }
        setErrorMessage(error.message || "Remediation could not be saved.");
        return;
      }
      setErrorMessage("Remediation could not be saved.");
    },
  });

  if (!canManage) {
    return (
      <div className="space-y-2" data-testid="remediation-editor-readonly">
        <p className="text-sm text-[var(--text)]">
          {normalizeStatus(status).replaceAll("_", " ")} · {title ?? "No remediation title"}. Due{" "}
          {dueOn ?? "not recorded"}. Owner {ownerLabel}.
        </p>
        <p className="text-xs text-[var(--muted)]">
          Remediation is read-only without the vulnerability.manage permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="remediation-editor">
      <label className="block text-xs text-[var(--muted)]">
        Remediation status
        <select
          className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
          value={draftStatus}
          onChange={(event) => {
            setDraftStatus(event.target.value as RemediationStatusValue);
            setSuccessMessage(null);
          }}
          data-testid="remediation-status"
        >
          {STATUSES.map((option) => (
            <option key={option} value={option}>
              {option.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-[var(--muted)]">
        Remediation title
        <input
          className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
          value={draftTitle}
          onChange={(event) => {
            setDraftTitle(event.target.value);
            setSuccessMessage(null);
          }}
          data-testid="remediation-title"
        />
      </label>
      <label className="block text-xs text-[var(--muted)]">
        Due date
        <input
          type="date"
          className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
          value={draftDueOn}
          onChange={(event) => {
            setDraftDueOn(event.target.value);
            setSuccessMessage(null);
          }}
          data-testid="remediation-due-on"
        />
      </label>
      <div>
        <p className="text-xs text-[var(--muted)]">Owner</p>
        <p className="mt-1 text-sm text-[var(--text)]">{ownerLabel}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Owner stays read-only here. No user catalog is available on this page.
        </p>
      </div>
      <div>
        <p className="text-xs text-[var(--muted)]">Asset (selector)</p>
        <p className="mt-1 text-sm text-[var(--text)]" data-testid="remediation-asset-id">
          {assetId ?? "Not associated"}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Identifies the existing asset finding. The asset relationship cannot be reassigned.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={save.isPending}
          aria-busy={save.isPending || undefined}
          onClick={() => {
            setErrorMessage(null);
            setSuccessMessage(null);
            save.mutate();
          }}
          data-testid="remediation-save"
        >
          {save.isPending ? "Saving…" : "Save remediation"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={save.isPending}
          onClick={restore}
          data-testid="remediation-cancel"
        >
          Cancel
        </Button>
        {conflict ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void queryClient.invalidateQueries({
                queryKey: ["vulnerabilities", "detail", vulnerabilityId],
              });
              setConflict(false);
              setErrorMessage(null);
            }}
            data-testid="remediation-reload"
          >
            Reload remediation
          </Button>
        ) : null}
      </div>
      {successMessage ? (
        <p className="text-sm text-[var(--accent)]" role="status" data-testid="remediation-success">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-[var(--critical)]" role="alert" data-testid="remediation-error">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
