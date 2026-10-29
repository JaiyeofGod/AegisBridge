import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { ApiError } from "@/services/api-client";
import { updateRiskTreatment } from "@/services/risks";
import type {
  RiskTreatmentUpdate,
  TreatmentStatusValue,
  TreatmentStrategyValue,
} from "@/services/api-types";

const STRATEGIES = [
  "accept",
  "avoid",
  "mitigate",
  "transfer",
] as const satisfies readonly TreatmentStrategyValue[];
const STATUSES = [
  "planned",
  "in_progress",
  "complete",
  "deferred",
  "cancelled",
] as const satisfies readonly TreatmentStatusValue[];

type Props = {
  riskId: string;
  strategy: string | null;
  status: string | null;
  notes: string | null;
  updatedAt: string | null;
  readOnly: boolean;
};

function normalizeStrategy(value: string | null): TreatmentStrategyValue {
  const lower = (value ?? "").toLowerCase();
  return (STRATEGIES as readonly string[]).includes(lower)
    ? (lower as TreatmentStrategyValue)
    : "mitigate";
}

function normalizeStatus(value: string | null): TreatmentStatusValue {
  const lower = (value ?? "").toLowerCase().replaceAll(" ", "_");
  return (STATUSES as readonly string[]).includes(lower)
    ? (lower as TreatmentStatusValue)
    : "planned";
}

export function RiskTreatmentEditor({
  riskId,
  strategy,
  status,
  notes,
  updatedAt,
  readOnly,
}: Props) {
  const queryClient = useQueryClient();
  const { handleAccountUnauthorized } = useAuthActions();
  const [draftStrategy, setDraftStrategy] = useState(normalizeStrategy(strategy));
  const [draftStatus, setDraftStatus] = useState(normalizeStatus(status));
  const [draftNotes, setDraftNotes] = useState(notes ?? "");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    setDraftStrategy(normalizeStrategy(strategy));
    setDraftStatus(normalizeStatus(status));
    setDraftNotes(notes ?? "");
    setConflict(false);
    setErrorMessage(null);
  }, [riskId, strategy, status, notes, updatedAt]);

  const save = useMutation({
    mutationFn: async () => {
      const patch: RiskTreatmentUpdate = {};
      if (draftStrategy !== normalizeStrategy(strategy)) {
        patch.strategy = draftStrategy;
      }
      if (draftStatus !== normalizeStatus(status)) {
        patch.status = draftStatus;
      }
      if (draftNotes !== (notes ?? "")) {
        patch.notes = draftNotes;
      }
      if (Object.keys(patch).length === 0) {
        throw new ApiError("No treatment changes to save.", 400, "no_changes");
      }
      if (updatedAt) {
        patch.expected_updated_at = updatedAt;
      }
      return updateRiskTreatment(riskId, patch);
    },
    onSuccess: async (detail) => {
      setSuccessMessage("Treatment updated.");
      setErrorMessage(null);
      setConflict(false);
      queryClient.setQueryData(["risks", "detail", riskId], detail);
      await queryClient.invalidateQueries({ queryKey: ["risks"] });
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
          setErrorMessage("This treatment changed since you loaded it.");
          return;
        }
        if (error.status === 403) {
          setErrorMessage("You do not have permission to update risk treatments.");
          return;
        }
        if (error.status === 404) {
          setErrorMessage("This risk was not found.");
          return;
        }
        if (error.status === 422) {
          setErrorMessage(error.message || "Treatment values are invalid.");
          return;
        }
        if (error.code === "no_changes") {
          setErrorMessage("No treatment changes to save.");
          return;
        }
        setErrorMessage(error.message || "Treatment could not be saved.");
        return;
      }
      setErrorMessage("Treatment could not be saved.");
    },
  });

  if (readOnly) {
    return (
      <div className="space-y-2" data-testid="risk-treatment-readonly">
        <p className="text-sm text-[var(--text)]">
          {(strategy ?? "Not recorded").replaceAll("_", " ")} ·{" "}
          {(status ?? "Not recorded").replaceAll("_", " ")}.{" "}
          {notes ?? "No treatment notes are stored."}
        </p>
        <p className="text-xs text-[var(--muted)]">
          Treatment is read-only without the risk.manage permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="risk-treatment-editor">
      <label className="block text-xs text-[var(--muted)]">
        Strategy
        <select
          className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
          value={draftStrategy}
          onChange={(event) => {
            setDraftStrategy(event.target.value as TreatmentStrategyValue);
            setSuccessMessage(null);
          }}
          data-testid="treatment-strategy"
        >
          {STRATEGIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-[var(--muted)]">
        Status
        <select
          className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
          value={draftStatus}
          onChange={(event) => {
            setDraftStatus(event.target.value as TreatmentStatusValue);
            setSuccessMessage(null);
          }}
          data-testid="treatment-status"
        >
          {STATUSES.map((option) => (
            <option key={option} value={option}>
              {option.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-[var(--muted)]">
        Notes
        <textarea
          className="mt-1 block min-h-24 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
          value={draftNotes}
          onChange={(event) => {
            setDraftNotes(event.target.value);
            setSuccessMessage(null);
          }}
          data-testid="treatment-notes"
        />
      </label>
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
          data-testid="treatment-save"
        >
          {save.isPending ? "Saving…" : "Save treatment"}
        </Button>
        {conflict ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ["risks", "detail", riskId] });
              setConflict(false);
              setErrorMessage(null);
            }}
            data-testid="treatment-reload"
          >
            Reload treatment
          </Button>
        ) : null}
      </div>
      {successMessage ? (
        <p
          className="motion-status-enter text-sm text-[var(--accent)]"
          role="status"
          data-testid="treatment-success"
        >
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-[var(--critical)]" role="alert" data-testid="treatment-error">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
