import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { invalidateAdministrationWrites } from "@/features/administration/admin-mutations";
import { Button } from "@/components/buttons/Button";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { ApiError } from "@/services/api-client";
import { updateAccessReview } from "@/services/administration";
import type { AccessReviewStatusValue, AccessReviewUpdate } from "@/services/api-types";

const STATUSES = [
  "in_progress",
  "closed",
  "completed",
  "cancelled",
] as const satisfies readonly AccessReviewStatusValue[];

type Props = {
  reviewId: string;
  name: string;
  status: string;
  updatedAt: string | null;
  canManage: boolean;
};

function normalizeStatus(value: string): AccessReviewStatusValue {
  const lower = value.toLowerCase().replaceAll(" ", "_");
  return (STATUSES as readonly string[]).includes(lower)
    ? (lower as AccessReviewStatusValue)
    : "in_progress";
}

export function AccessReviewEditor({ reviewId, name, status, updatedAt, canManage }: Props) {
  const queryClient = useQueryClient();
  const { handleAccountUnauthorized } = useAuthActions();
  const [draftName, setDraftName] = useState(name);
  const [draftStatus, setDraftStatus] = useState(normalizeStatus(status));
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    setDraftName(name);
    setDraftStatus(normalizeStatus(status));
    setConflict(false);
    setErrorMessage(null);
  }, [reviewId, name, status, updatedAt]);

  function restore() {
    setDraftName(name);
    setDraftStatus(normalizeStatus(status));
    setErrorMessage(null);
    setSuccessMessage(null);
    setConflict(false);
  }

  const save = useMutation({
    mutationFn: async () => {
      const patch: AccessReviewUpdate = {};
      if (draftName.trim() !== name) {
        patch.name = draftName.trim();
      }
      if (draftStatus !== normalizeStatus(status)) {
        patch.status = draftStatus;
      }
      if (Object.keys(patch).length === 0) {
        throw new ApiError("No access-review changes to save.", 400, "no_changes");
      }
      if (updatedAt) {
        patch.expected_updated_at = updatedAt;
      }
      return updateAccessReview(reviewId, patch);
    },
    onSuccess: async () => {
      setSuccessMessage("Access review updated.");
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
        if (error.status === 409) {
          setConflict(true);
          setErrorMessage(error.message || "This access review changed since you loaded it.");
          return;
        }
        if (error.status === 403) {
          setErrorMessage("You do not have permission to update access reviews.");
          return;
        }
        if (error.status === 404) {
          setErrorMessage("This access review was not found.");
          return;
        }
        if (error.status === 422) {
          setErrorMessage(error.message || "Access-review values are invalid.");
          return;
        }
        if (error.code === "no_changes") {
          setErrorMessage("No access-review changes to save.");
          return;
        }
        setErrorMessage(error.message || "Access review could not be saved.");
        return;
      }
      setErrorMessage("Access review could not be saved.");
    },
  });

  if (!canManage) {
    return (
      <div className="space-y-2" data-testid="access-review-editor-readonly">
        <p className="text-sm text-[var(--text)]">
          {name} · {normalizeStatus(status).replaceAll("_", " ")}
        </p>
        <p className="text-xs text-[var(--muted)]">
          Access reviews are read-only without the administration.manage permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="access-review-editor">
      <label className="block text-xs text-[var(--muted)]">
        Review name
        <input
          className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
          value={draftName}
          onChange={(event) => {
            setDraftName(event.target.value);
            setSuccessMessage(null);
          }}
          data-testid="access-review-name"
        />
      </label>
      <label className="block text-xs text-[var(--muted)]">
        Review status
        <select
          className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
          value={draftStatus}
          onChange={(event) => {
            setDraftStatus(event.target.value as AccessReviewStatusValue);
            setSuccessMessage(null);
          }}
          data-testid="access-review-status"
        >
          {STATUSES.map((option) => (
            <option key={option} value={option}>
              {option.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-[var(--muted)]">
        Owner and due date are not stored by the API and cannot be edited here. Findings are not
        editable in this phase.
      </p>
      {successMessage ? (
        <p
          className="text-sm text-[var(--accent)]"
          data-testid="access-review-success"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-[var(--danger)]" data-testid="access-review-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          data-testid="access-review-save"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="secondary" disabled={save.isPending} onClick={restore}>
          Cancel
        </Button>
        {conflict ? (
          <Button
            type="button"
            variant="secondary"
            data-testid="access-review-reload"
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
