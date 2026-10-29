import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { invalidateGovernanceWrites } from "@/features/governance/governance-mutations";
import { formatTimestamp } from "@/lib/format";
import { ApiError } from "@/services/api-client";
import type {
  ControlTestItem,
  ControlTestResultValue,
  ControlTestUpdate,
} from "@/services/api-types";
import { createControlTest, updateControlTest } from "@/services/governance";

const RESULTS = [
  "pass",
  "fail",
  "partial",
  "inconclusive",
] as const satisfies readonly ControlTestResultValue[];

type Props = {
  controlId: string;
  tests: ControlTestItem[];
  canManage: boolean;
};

function normalizeResult(value: string): ControlTestResultValue {
  const lower = value.toLowerCase().replaceAll(" ", "_");
  return (RESULTS as readonly string[]).includes(lower)
    ? (lower as ControlTestResultValue)
    : "inconclusive";
}

export function ControlTestPanel({ controlId, tests, canManage }: Props) {
  const queryClient = useQueryClient();
  const { handleAccountUnauthorized } = useAuthActions();
  const [result, setResult] = useState<ControlTestResultValue>("inconclusive");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editResult, setEditResult] = useState<ControlTestResultValue>("inconclusive");
  const [editNotes, setEditNotes] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    setEditingId(null);
    setSuccessMessage(null);
    setErrorMessage(null);
    setConflict(false);
  }, [controlId]);

  const create = useMutation({
    mutationFn: async () =>
      createControlTest(controlId, {
        result,
        notes: notes.trim() === "" ? null : notes.trim(),
      }),
    onSuccess: async (created) => {
      setSuccessMessage(`Manual control test ${created.id} recorded.`);
      setErrorMessage(null);
      setNotes("");
      setResult("inconclusive");
      await invalidateGovernanceWrites(queryClient, { controlId });
    },
    onError: async (error) => {
      setSuccessMessage(null);
      if (await handleAccountUnauthorized(error)) {
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setErrorMessage("You do not have permission to record control tests.");
          return;
        }
        if (error.status === 404) {
          setErrorMessage("This control was not found.");
          return;
        }
        if (error.status === 422) {
          setErrorMessage(error.message || "Control test values are invalid.");
          return;
        }
        setErrorMessage(error.message || "Control test could not be recorded.");
        return;
      }
      setErrorMessage("Control test could not be recorded.");
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editingId) {
        throw new ApiError("No control test selected.", 400, "no_changes");
      }
      const current = tests.find((test) => test.id === editingId);
      if (!current) {
        throw new ApiError("This control test was not found.", 404, "not_found");
      }
      const patch: ControlTestUpdate = {};
      if (editResult !== normalizeResult(current.result)) {
        patch.result = editResult;
      }
      if (editNotes !== (current.notes ?? "")) {
        patch.notes = editNotes;
      }
      if (Object.keys(patch).length === 0) {
        throw new ApiError("No control-test changes to save.", 400, "no_changes");
      }
      if (current.updated_at) {
        patch.expected_updated_at = current.updated_at;
      }
      return updateControlTest(editingId, patch);
    },
    onSuccess: async (updated) => {
      setSuccessMessage(`Control test ${updated.id} updated.`);
      setErrorMessage(null);
      setConflict(false);
      setEditingId(null);
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
          setErrorMessage(error.message || "This control test changed since you loaded it.");
          return;
        }
        if (error.status === 403) {
          setErrorMessage("You do not have permission to update control tests.");
          return;
        }
        if (error.status === 404) {
          setErrorMessage("This control test was not found.");
          return;
        }
        if (error.status === 422) {
          setErrorMessage(error.message || "Control test values are invalid.");
          return;
        }
        if (error.code === "no_changes") {
          setErrorMessage("No control-test changes to save.");
          return;
        }
        setErrorMessage(error.message || "Control test could not be updated.");
        return;
      }
      setErrorMessage("Control test could not be updated.");
    },
  });

  return (
    <div className="space-y-4" data-testid="control-test-panel">
      <p className="text-sm text-[var(--muted)]" data-testid="control-test-manual-label">
        Manually recorded development assessments only. This is not automated control validation or
        continuous monitoring.
      </p>

      <ul className="space-y-2" data-testid="control-test-list">
        {tests.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">
            No control tests recorded for this control.
          </li>
        ) : (
          tests.map((test) => (
            <li
              key={test.id}
              className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-3 py-3"
              data-testid={`control-test-row-${test.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-[var(--text)]">
                    {test.id} · {normalizeResult(test.result).replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatTimestamp(test.tested_at)}
                    {test.tester ? ` · ${test.tester.display_name}` : ""} · {test.recording_mode}
                  </p>
                  {test.notes ? <p className="text-xs text-[var(--muted)]">{test.notes}</p> : null}
                </div>
                {canManage ? (
                  <Button
                    type="button"
                    variant="secondary"
                    data-testid={`control-test-edit-${test.id}`}
                    onClick={() => {
                      setEditingId(test.id);
                      setEditResult(normalizeResult(test.result));
                      setEditNotes(test.notes ?? "");
                      setSuccessMessage(null);
                      setErrorMessage(null);
                      setConflict(false);
                    }}
                  >
                    Edit
                  </Button>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>

      {!canManage ? (
        <p className="text-xs text-[var(--muted)]" data-testid="control-test-readonly">
          Recording and updating tests requires the control.manage permission.
        </p>
      ) : (
        <div className="space-y-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-4">
          <h4 className="font-heading text-sm font-semibold text-[var(--text)]">
            {editingId ? `Update ${editingId}` : "Record manual test"}
          </h4>
          <label className="block text-xs text-[var(--muted)]">
            Result
            <select
              className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
              value={editingId ? editResult : result}
              onChange={(event) => {
                const value = event.target.value as ControlTestResultValue;
                if (editingId) setEditResult(value);
                else setResult(value);
                setSuccessMessage(null);
              }}
              data-testid="control-test-result"
            >
              {RESULTS.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Notes
            <textarea
              className="mt-1 block min-h-20 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
              value={editingId ? editNotes : notes}
              onChange={(event) => {
                if (editingId) setEditNotes(event.target.value);
                else setNotes(event.target.value);
                setSuccessMessage(null);
              }}
              data-testid="control-test-notes"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {editingId ? (
              <>
                <Button
                  type="button"
                  data-testid="control-test-update-save"
                  disabled={update.isPending}
                  onClick={() => update.mutate()}
                >
                  {update.isPending ? "Saving…" : "Save test"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={update.isPending}
                  onClick={() => {
                    setEditingId(null);
                    setConflict(false);
                    setErrorMessage(null);
                  }}
                >
                  Cancel edit
                </Button>
                {conflict ? (
                  <Button
                    type="button"
                    variant="secondary"
                    data-testid="control-test-reload"
                    onClick={() => {
                      void invalidateGovernanceWrites(queryClient, { controlId });
                      setConflict(false);
                      setErrorMessage(null);
                    }}
                  >
                    Reload
                  </Button>
                ) : null}
              </>
            ) : (
              <Button
                type="button"
                data-testid="control-test-create"
                disabled={create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? "Recording…" : "Record test"}
              </Button>
            )}
          </div>
        </div>
      )}

      {successMessage ? (
        <p
          className="motion-status-enter text-sm text-[var(--accent)]"
          data-testid="control-test-success"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-[var(--danger)]" data-testid="control-test-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
