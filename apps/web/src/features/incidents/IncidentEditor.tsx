import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { ApiError } from "@/services/api-client";
import { updateIncident } from "@/services/incidents";
import type {
  IncidentSeverityValue,
  IncidentStatusValue,
  IncidentUpdate,
} from "@/services/api-types";

const SEVERITIES = [
  "critical",
  "high",
  "medium",
  "low",
  "informational",
] as const satisfies readonly IncidentSeverityValue[];

const OPEN_STATUSES = [
  "new",
  "investigating",
  "contained",
  "mitigated",
] as const satisfies readonly IncidentStatusValue[];

const CLOSE_STATUSES = ["resolved", "closed"] as const satisfies readonly IncidentStatusValue[];

type Props = {
  incidentId: string;
  title: string;
  severity: string;
  status: string;
  summary: string;
  ownerLabel: string;
  updatedAt: string | null;
  canManage: boolean;
  canClose: boolean;
};

function normalizeSeverity(value: string): IncidentSeverityValue {
  const lower = value.toLowerCase().replaceAll(" ", "_");
  return (SEVERITIES as readonly string[]).includes(lower)
    ? (lower as IncidentSeverityValue)
    : "medium";
}

function normalizeStatus(value: string): IncidentStatusValue {
  const lower = value.toLowerCase().replaceAll(" ", "_");
  const all = [...OPEN_STATUSES, ...CLOSE_STATUSES];
  return all.includes(lower as IncidentStatusValue)
    ? (lower as IncidentStatusValue)
    : "investigating";
}

export function IncidentEditor({
  incidentId,
  title,
  severity,
  status,
  summary,
  ownerLabel,
  updatedAt,
  canManage,
  canClose,
}: Props) {
  const queryClient = useQueryClient();
  const { handleAccountUnauthorized } = useAuthActions();
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftSeverity, setDraftSeverity] = useState(normalizeSeverity(severity));
  const [draftStatus, setDraftStatus] = useState(normalizeStatus(status));
  const [draftSummary, setDraftSummary] = useState(summary);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const statusOptions = useMemo(() => {
    const open = [...OPEN_STATUSES];
    if (canClose) return [...open, ...CLOSE_STATUSES];
    const current = normalizeStatus(status);
    if ((CLOSE_STATUSES as readonly string[]).includes(current)) {
      return [...open, current];
    }
    return open;
  }, [canClose, status]);

  useEffect(() => {
    setDraftTitle(title);
    setDraftSeverity(normalizeSeverity(severity));
    setDraftStatus(normalizeStatus(status));
    setDraftSummary(summary);
    setConflict(false);
    setErrorMessage(null);
  }, [incidentId, title, severity, status, summary, updatedAt]);

  function restore() {
    setDraftTitle(title);
    setDraftSeverity(normalizeSeverity(severity));
    setDraftStatus(normalizeStatus(status));
    setDraftSummary(summary);
    setErrorMessage(null);
    setSuccessMessage(null);
    setConflict(false);
  }

  const save = useMutation({
    mutationFn: async () => {
      const patch: IncidentUpdate = {};
      if (draftTitle.trim() !== title) {
        patch.title = draftTitle.trim();
      }
      if (draftSeverity !== normalizeSeverity(severity)) {
        patch.severity = draftSeverity;
      }
      if (draftStatus !== normalizeStatus(status)) {
        patch.status = draftStatus;
      }
      if (draftSummary !== summary) {
        patch.summary = draftSummary;
      }
      if (Object.keys(patch).length === 0) {
        throw new ApiError("No incident changes to save.", 400, "no_changes");
      }
      if (updatedAt) {
        patch.expected_updated_at = updatedAt;
      }
      return updateIncident(incidentId, patch);
    },
    onSuccess: async (detail) => {
      setSuccessMessage("Incident updated.");
      setErrorMessage(null);
      setConflict(false);
      queryClient.setQueryData(["incidents", "detail", incidentId], detail);
      await queryClient.invalidateQueries({ queryKey: ["incidents"] });
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
          setErrorMessage("This incident changed since you loaded it.");
          return;
        }
        if (error.status === 403) {
          setErrorMessage("You do not have permission to update this incident.");
          return;
        }
        if (error.status === 404) {
          setErrorMessage("This incident was not found.");
          return;
        }
        if (error.status === 422) {
          setErrorMessage(error.message || "Incident values are invalid.");
          return;
        }
        if (error.code === "no_changes") {
          setErrorMessage("No incident changes to save.");
          return;
        }
        setErrorMessage(error.message || "Incident could not be saved.");
        return;
      }
      setErrorMessage("Incident could not be saved.");
    },
  });

  if (!canManage) {
    return (
      <div className="space-y-2" data-testid="incident-editor-readonly">
        <p className="text-sm text-[var(--text)]">
          {normalizeSeverity(severity)} · {normalizeStatus(status)}. Owner {ownerLabel}.
        </p>
        <p className="text-xs text-[var(--muted)]">
          Incident fields are read-only without the incident.manage permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="incident-editor">
      <label className="block text-xs text-[var(--muted)]">
        Title
        <input
          className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
          value={draftTitle}
          onChange={(event) => {
            setDraftTitle(event.target.value);
            setSuccessMessage(null);
          }}
          data-testid="incident-title"
        />
      </label>
      <label className="block text-xs text-[var(--muted)]">
        Incident severity
        <select
          className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
          value={draftSeverity}
          onChange={(event) => {
            setDraftSeverity(event.target.value as IncidentSeverityValue);
            setSuccessMessage(null);
          }}
          data-testid="incident-severity"
        >
          {SEVERITIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-[var(--muted)]">
        Incident status
        <select
          className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
          value={draftStatus}
          onChange={(event) => {
            setDraftStatus(event.target.value as IncidentStatusValue);
            setSuccessMessage(null);
          }}
          data-testid="incident-status"
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      {!canClose ? (
        <p className="text-xs text-[var(--muted)]">
          Closing or resolving requires the incident.close permission.
        </p>
      ) : null}
      <label className="block text-xs text-[var(--muted)]">
        Summary
        <textarea
          className="mt-1 block min-h-24 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
          value={draftSummary}
          onChange={(event) => {
            setDraftSummary(event.target.value);
            setSuccessMessage(null);
          }}
          data-testid="incident-summary"
        />
      </label>
      <div>
        <p className="text-xs text-[var(--muted)]">Owner</p>
        <p className="mt-1 text-sm text-[var(--text)]">{ownerLabel}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Owner stays read-only here. No user catalog is available on this page.
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
          data-testid="incident-save"
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={save.isPending}
          onClick={restore}
          data-testid="incident-cancel"
        >
          Cancel
        </Button>
        {conflict ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void queryClient.invalidateQueries({
                queryKey: ["incidents", "detail", incidentId],
              });
              setConflict(false);
              setErrorMessage(null);
            }}
            data-testid="incident-reload"
          >
            Reload incident
          </Button>
        ) : null}
      </div>
      {successMessage ? (
        <p className="text-sm text-[var(--accent)]" role="status" data-testid="incident-success">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-[var(--critical)]" role="alert" data-testid="incident-error">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
