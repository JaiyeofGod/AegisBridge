import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { invalidateGovernanceWrites } from "@/features/governance/governance-mutations";
import { ApiError } from "@/services/api-client";
import type {
  ControlImplementationDetail,
  ControlImplementationStatusValue,
  ControlImplementationUpdate,
} from "@/services/api-types";
import { updateControlImplementation } from "@/services/governance";

const STATUSES = [
  "planned",
  "partial",
  "implemented",
  "not_implemented",
  "not_applicable",
] as const satisfies readonly ControlImplementationStatusValue[];

type Props = {
  controlId: string;
  implementation: ControlImplementationDetail | null;
  canManage: boolean;
};

function normalizeStatus(value: string | null | undefined): ControlImplementationStatusValue {
  const lower = (value ?? "planned").toLowerCase().replaceAll(" ", "_");
  return (STATUSES as readonly string[]).includes(lower)
    ? (lower as ControlImplementationStatusValue)
    : "planned";
}

export function ControlImplementationEditor({ controlId, implementation, canManage }: Props) {
  const queryClient = useQueryClient();
  const { handleAccountUnauthorized } = useAuthActions();
  const [draftStatus, setDraftStatus] = useState(normalizeStatus(implementation?.status));
  const [draftNotes, setDraftNotes] = useState(implementation?.notes ?? "");
  const [draftOwner, setDraftOwner] = useState(implementation?.owner?.id ?? "");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    setDraftStatus(normalizeStatus(implementation?.status));
    setDraftNotes(implementation?.notes ?? "");
    setDraftOwner(implementation?.owner?.id ?? "");
    setConflict(false);
    setErrorMessage(null);
  }, [
    controlId,
    implementation?.status,
    implementation?.notes,
    implementation?.owner?.id,
    implementation?.updated_at,
  ]);

  function restore() {
    setDraftStatus(normalizeStatus(implementation?.status));
    setDraftNotes(implementation?.notes ?? "");
    setDraftOwner(implementation?.owner?.id ?? "");
    setErrorMessage(null);
    setSuccessMessage(null);
    setConflict(false);
  }

  const save = useMutation({
    mutationFn: async () => {
      const patch: ControlImplementationUpdate = {};
      if (draftStatus !== normalizeStatus(implementation?.status)) {
        patch.status = draftStatus;
      }
      if (draftNotes !== (implementation?.notes ?? "")) {
        patch.notes = draftNotes;
      }
      const nextOwner = draftOwner.trim() === "" ? null : draftOwner.trim();
      const currentOwner = implementation?.owner?.id ?? null;
      if (nextOwner !== currentOwner) {
        patch.owner = nextOwner;
      }
      if (Object.keys(patch).length === 0) {
        throw new ApiError("No implementation changes to save.", 400, "no_changes");
      }
      if (implementation?.updated_at) {
        patch.expected_updated_at = implementation.updated_at;
      }
      return updateControlImplementation(controlId, patch);
    },
    onSuccess: async (detail) => {
      setSuccessMessage("Control implementation updated.");
      setErrorMessage(null);
      setConflict(false);
      queryClient.setQueryData(["governance", "control", controlId], detail);
      await invalidateGovernanceWrites(queryClient, { controlId });
    },
    onError: async (error) => {
      setSuccessMessage(null);
      if (await handleAccountUnauthorized(error)) {
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setConflict(true);
          setErrorMessage(
            error.message || "This control implementation changed since you loaded it.",
          );
          return;
        }
        if (error.status === 403) {
          setErrorMessage("You do not have permission to update control implementations.");
          return;
        }
        if (error.status === 404) {
          setErrorMessage("This control was not found.");
          return;
        }
        if (error.status === 422) {
          setErrorMessage(error.message || "Implementation values are invalid.");
          return;
        }
        if (error.code === "no_changes") {
          setErrorMessage("No implementation changes to save.");
          return;
        }
        setErrorMessage(error.message || "Implementation could not be saved.");
        return;
      }
      setErrorMessage("Implementation could not be saved.");
    },
  });

  if (!canManage) {
    return (
      <div className="space-y-2" data-testid="control-implementation-readonly">
        <p className="text-sm text-[var(--text)]">
          {normalizeStatus(implementation?.status).replaceAll("_", " ")}
          {implementation?.owner ? ` · Owner ${implementation.owner.display_name}` : ""}
        </p>
        {implementation?.notes ? (
          <p className="text-sm text-[var(--muted)]">{implementation.notes}</p>
        ) : null}
        <p className="text-xs text-[var(--muted)]">
          Implementation is read-only without the control.manage permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="control-implementation-editor">
      <label className="block text-xs text-[var(--muted)]">
        Implementation status
        <select
          className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
          value={draftStatus}
          onChange={(event) => {
            setDraftStatus(event.target.value as ControlImplementationStatusValue);
            setSuccessMessage(null);
          }}
          data-testid="control-implementation-status"
        >
          {STATUSES.map((option) => (
            <option key={option} value={option}>
              {option.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-[var(--muted)]">
        Implementation notes
        <textarea
          className="mt-1 block min-h-24 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
          value={draftNotes}
          onChange={(event) => {
            setDraftNotes(event.target.value);
            setSuccessMessage(null);
          }}
          data-testid="control-implementation-notes"
        />
      </label>
      <label className="block text-xs text-[var(--muted)]">
        Owner user id
        <input
          className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
          value={draftOwner}
          placeholder="USR-0003"
          onChange={(event) => {
            setDraftOwner(event.target.value);
            setSuccessMessage(null);
          }}
          data-testid="control-implementation-owner"
        />
      </label>
      <p className="text-xs text-[var(--muted)]">
        Licensed CIS safeguard text is not shown or editable. Only stored status, notes, and owner
        id are written.
      </p>
      {successMessage ? (
        <p
          className="motion-status-enter text-sm text-[var(--accent)]"
          data-testid="control-implementation-success"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          className="text-sm text-[var(--danger)]"
          data-testid="control-implementation-error"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          data-testid="control-implementation-save"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save implementation"}
        </Button>
        <Button type="button" variant="secondary" disabled={save.isPending} onClick={restore}>
          Cancel
        </Button>
        {conflict ? (
          <Button
            type="button"
            variant="secondary"
            data-testid="control-implementation-reload"
            onClick={() => {
              void invalidateGovernanceWrites(queryClient, { controlId });
              setConflict(false);
              setErrorMessage(null);
            }}
          >
            Reload
          </Button>
        ) : null}
      </div>
    </div>
  );
}
