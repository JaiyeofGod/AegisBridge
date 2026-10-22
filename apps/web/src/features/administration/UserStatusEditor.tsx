import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { invalidateAdministrationWrites } from "@/features/administration/admin-mutations";
import { Button } from "@/components/buttons/Button";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { ApiError } from "@/services/api-client";
import { updateUserStatus } from "@/services/administration";
import type { AdminAccountStatus, UserStatusUpdate } from "@/services/api-types";

const STATUSES = ["active", "inactive"] as const satisfies readonly AdminAccountStatus[];

type Props = {
  userId: string;
  status: string;
  updatedAt: string | null;
  canManage: boolean;
};

function normalizeStatus(value: string): AdminAccountStatus {
  const lower = value.toLowerCase();
  return (STATUSES as readonly string[]).includes(lower) ? (lower as AdminAccountStatus) : "active";
}

export function UserStatusEditor({ userId, status, updatedAt, canManage }: Props) {
  const queryClient = useQueryClient();
  const { handleAccountUnauthorized } = useAuthActions();
  const [draftStatus, setDraftStatus] = useState(normalizeStatus(status));
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    setDraftStatus(normalizeStatus(status));
    setConflict(false);
    setErrorMessage(null);
  }, [userId, status, updatedAt]);

  function restore() {
    setDraftStatus(normalizeStatus(status));
    setErrorMessage(null);
    setSuccessMessage(null);
    setConflict(false);
  }

  const save = useMutation({
    mutationFn: async () => {
      const next = draftStatus;
      const current = normalizeStatus(status);
      if (next === current) {
        throw new ApiError("No user status changes to save.", 400, "no_changes");
      }
      if (current === "active" && next === "inactive") {
        const confirmed = window.confirm(
          `Set ${userId} to inactive? The account will no longer be able to sign in.`,
        );
        if (!confirmed) {
          throw new ApiError("Status change cancelled.", 400, "cancelled");
        }
      }
      const patch: UserStatusUpdate = { status: next };
      if (updatedAt) {
        patch.expected_updated_at = updatedAt;
      }
      return updateUserStatus(userId, patch);
    },
    onSuccess: async () => {
      setSuccessMessage("User status updated.");
      setErrorMessage(null);
      setConflict(false);
      await invalidateAdministrationWrites(queryClient);
    },
    onError: async (error) => {
      setSuccessMessage(null);
      if (await handleAccountUnauthorized(error)) {
        return;
      }
      if (error instanceof ApiError) {
        if (error.code === "cancelled") {
          setErrorMessage(null);
          return;
        }
        if (error.status === 409) {
          setConflict(true);
          setErrorMessage(
            error.message ||
              "This change conflicts with administrative safety rules or a concurrent update.",
          );
          return;
        }
        if (error.status === 403) {
          setErrorMessage("You do not have permission to update user status.");
          return;
        }
        if (error.status === 404) {
          setErrorMessage("This user was not found.");
          return;
        }
        if (error.status === 422) {
          setErrorMessage(error.message || "User status is invalid.");
          return;
        }
        if (error.code === "no_changes") {
          setErrorMessage("No user status changes to save.");
          return;
        }
        setErrorMessage(error.message || "User status could not be saved.");
        return;
      }
      setErrorMessage("User status could not be saved.");
    },
  });

  if (!canManage) {
    return (
      <div className="space-y-2" data-testid="user-status-editor-readonly">
        <p className="text-sm text-[var(--text)]">Status {normalizeStatus(status)}</p>
        <p className="text-xs text-[var(--muted)]">
          User status is read-only without the administration.manage permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="user-status-editor">
      <label className="block text-xs text-[var(--muted)]">
        Account status
        <select
          className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
          value={draftStatus}
          onChange={(event) => {
            setDraftStatus(event.target.value as AdminAccountStatus);
            setSuccessMessage(null);
          }}
          data-testid="user-status-select"
        >
          {STATUSES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-[var(--muted)]">
        Email, human id, credentials, and permissions cannot be changed here. Setting inactive
        requires confirmation.
      </p>
      {successMessage ? (
        <p className="text-sm text-[var(--accent)]" data-testid="user-status-success" role="status">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-[var(--danger)]" data-testid="user-status-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          data-testid="user-status-save"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save status"}
        </Button>
        <Button type="button" variant="secondary" disabled={save.isPending} onClick={restore}>
          Cancel
        </Button>
        {conflict ? (
          <Button
            type="button"
            variant="secondary"
            data-testid="user-status-reload"
            onClick={() => {
              void invalidateAdministrationWrites(queryClient);
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
