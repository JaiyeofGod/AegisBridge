import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { invalidateGovernanceWrites } from "@/features/governance/governance-mutations";
import { formatTimestamp } from "@/lib/format";
import { ApiError } from "@/services/api-client";
import type {
  ControlEvidenceItem,
  EvidenceClassificationValue,
  EvidenceCreate,
  EvidenceDetail,
} from "@/services/api-types";
import { createEvidence, linkControlEvidence, unlinkControlEvidence } from "@/services/governance";

const CLASSIFICATIONS = [
  "simulated",
  "internal",
  "confidential",
  "restricted",
] as const satisfies readonly EvidenceClassificationValue[];

const SHA256_PATTERN = /^[0-9a-fA-F]{64}$/;

type Props = {
  controlId: string;
  evidence: ControlEvidenceItem[];
  canManageEvidence: boolean;
  canLink: boolean;
};

export function ControlEvidencePanel({ controlId, evidence, canManageEvidence, canLink }: Props) {
  const queryClient = useQueryClient();
  const { handleAccountUnauthorized } = useAuthActions();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sha256, setSha256] = useState("");
  const [classification, setClassification] = useState<EvidenceClassificationValue>("simulated");
  const [linkEvidenceId, setLinkEvidenceId] = useState("");
  const [created, setCreated] = useState<EvidenceDetail | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingUnlinkId, setPendingUnlinkId] = useState<string | null>(null);

  useEffect(() => {
    setCreated(null);
    setSuccessMessage(null);
    setErrorMessage(null);
    setPendingUnlinkId(null);
    setTitle("");
    setDescription("");
    setSha256("");
    setLinkEvidenceId("");
    setClassification("simulated");
  }, [controlId]);

  const create = useMutation({
    mutationFn: async () => {
      const trimmedSha = sha256.trim();
      if (trimmedSha && !SHA256_PATTERN.test(trimmedSha)) {
        throw new ApiError(
          "SHA-256 must be exactly 64 hexadecimal characters.",
          422,
          "validation_error",
        );
      }
      const body: EvidenceCreate = {
        title: title.trim(),
        description: description.trim() === "" ? null : description.trim(),
        data_classification: classification,
      };
      if (trimmedSha) {
        body.sha256 = trimmedSha;
      }
      return createEvidence(body);
    },
    onSuccess: async (detail) => {
      setCreated(detail);
      setSuccessMessage(`Evidence metadata ${detail.id} created. No file was uploaded.`);
      setErrorMessage(null);
      setTitle("");
      setDescription("");
      setSha256("");
      setLinkEvidenceId(detail.id);
      await invalidateGovernanceWrites(queryClient, { evidenceId: detail.id });
    },
    onError: async (error) => {
      setSuccessMessage(null);
      if (await handleAccountUnauthorized(error)) {
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setErrorMessage("You do not have permission to create evidence metadata.");
          return;
        }
        if (error.status === 422) {
          setErrorMessage(error.message || "Evidence values are invalid.");
          return;
        }
        setErrorMessage(error.message || "Evidence metadata could not be created.");
        return;
      }
      setErrorMessage("Evidence metadata could not be created.");
    },
  });

  const link = useMutation({
    mutationFn: async (evidenceId: string) => linkControlEvidence(controlId, evidenceId),
    onSuccess: async (result) => {
      setSuccessMessage(
        result.linked
          ? `Evidence ${result.evidence_id} linked to ${result.control_id}.`
          : `Evidence ${result.evidence_id} is already linked.`,
      );
      setErrorMessage(null);
      await invalidateGovernanceWrites(queryClient, {
        controlId,
        evidenceId: result.evidence_id,
      });
    },
    onError: async (error) => {
      setSuccessMessage(null);
      if (await handleAccountUnauthorized(error)) {
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setErrorMessage("Linking requires control.manage and evidence.manage.");
          return;
        }
        if (error.status === 404) {
          setErrorMessage("Control or evidence was not found.");
          return;
        }
        if (error.status === 409) {
          setErrorMessage(error.message || "Evidence is already linked to this control.");
          return;
        }
        setErrorMessage(error.message || "Evidence could not be linked.");
        return;
      }
      setErrorMessage("Evidence could not be linked.");
    },
  });

  const unlink = useMutation({
    mutationFn: async (evidenceId: string) => unlinkControlEvidence(controlId, evidenceId),
    onSuccess: async (result) => {
      setPendingUnlinkId(null);
      setSuccessMessage(
        `Association removed between ${result.control_id} and ${result.evidence_id}. The evidence metadata record was not deleted.`,
      );
      setErrorMessage(null);
      await invalidateGovernanceWrites(queryClient, {
        controlId,
        evidenceId: result.evidence_id,
      });
    },
    onError: async (error) => {
      setSuccessMessage(null);
      if (await handleAccountUnauthorized(error)) {
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setErrorMessage("Unlinking requires control.manage and evidence.manage.");
          return;
        }
        if (error.status === 404) {
          setErrorMessage("Link, control, or evidence was not found.");
          return;
        }
        setErrorMessage(error.message || "Evidence could not be unlinked.");
        return;
      }
      setErrorMessage("Evidence could not be unlinked.");
    },
  });

  return (
    <div className="space-y-4" data-testid="control-evidence-panel">
      <p className="text-sm text-[var(--muted)]" data-testid="evidence-metadata-only-copy">
        Evidence metadata only. No file has been uploaded or stored. A SHA-256 value is
        caller-supplied metadata and is not verified integrity.
      </p>

      <ul className="space-y-2" data-testid="control-evidence-list">
        {evidence.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">No evidence linked to this control.</li>
        ) : (
          evidence.map((item) => (
            <li
              key={item.id}
              className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-3 py-3"
              data-testid={`control-evidence-row-${item.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-[var(--text)]">
                    {item.id} · {item.title}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {item.collected_at
                      ? formatTimestamp(item.collected_at)
                      : "collected_at not stored"}
                    {item.sha256 ? ` · SHA-256 present` : " · no SHA-256"}
                  </p>
                </div>
                {canLink ? (
                  pendingUnlinkId === item.id ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        data-testid={`control-evidence-unlink-confirm-${item.id}`}
                        disabled={unlink.isPending}
                        onClick={() => unlink.mutate(item.id)}
                      >
                        Confirm unlink
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setPendingUnlinkId(null)}
                      >
                        Cancel
                      </Button>
                      <p className="w-full text-xs text-[var(--muted)]">
                        Removes the association only. Does not delete the evidence record or any
                        storage object.
                      </p>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      data-testid={`control-evidence-unlink-${item.id}`}
                      onClick={() => {
                        setPendingUnlinkId(item.id);
                        setSuccessMessage(null);
                        setErrorMessage(null);
                      }}
                    >
                      Unlink
                    </Button>
                  )
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>

      {canManageEvidence ? (
        <div
          className="space-y-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-4"
          data-testid="evidence-create-form"
        >
          <h4 className="font-heading text-sm font-semibold text-[var(--text)]">
            Create evidence metadata
          </h4>
          <p className="text-xs text-[var(--muted)]">
            No file upload control is available. Object URIs and storage credentials are not
            accepted.
          </p>
          <label className="block text-xs text-[var(--muted)]">
            Title
            <input
              className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setSuccessMessage(null);
              }}
              data-testid="evidence-title"
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Description
            <textarea
              className="mt-1 block min-h-16 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setSuccessMessage(null);
              }}
              data-testid="evidence-description"
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            SHA-256 (optional, 64 hex)
            <input
              className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-mono text-sm text-[var(--text)]"
              value={sha256}
              onChange={(event) => {
                setSha256(event.target.value);
                setSuccessMessage(null);
              }}
              data-testid="evidence-sha256"
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Classification
            <select
              className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
              value={classification}
              onChange={(event) => {
                setClassification(event.target.value as EvidenceClassificationValue);
                setSuccessMessage(null);
              }}
              data-testid="evidence-classification"
            >
              {CLASSIFICATIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            data-testid="evidence-create"
            disabled={create.isPending || title.trim().length === 0}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Creating…" : "Create metadata"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)]" data-testid="evidence-create-readonly">
          Creating evidence metadata requires the evidence.manage permission.
        </p>
      )}

      {created ? (
        <div
          className="space-y-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-4"
          data-testid="evidence-created-summary"
        >
          <p className="text-sm text-[var(--text)]">
            Created {created.id}. object_stored={String(created.object_stored)}, integrity_verified=
            {String(created.integrity_verified)}.
          </p>
          <p className="text-xs text-[var(--muted)]">{created.semantics}</p>
          {canLink ? (
            <Button
              type="button"
              data-testid="evidence-link-created"
              disabled={link.isPending}
              onClick={() => link.mutate(created.id)}
            >
              Link {created.id} to this control
            </Button>
          ) : null}
        </div>
      ) : null}

      {canLink ? (
        <div className="space-y-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-4">
          <label className="block text-xs text-[var(--muted)]">
            Link existing evidence id
            <input
              className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
              value={linkEvidenceId}
              placeholder="EVID-0041"
              onChange={(event) => {
                setLinkEvidenceId(event.target.value);
                setSuccessMessage(null);
              }}
              data-testid="evidence-link-id"
            />
          </label>
          <Button
            type="button"
            data-testid="evidence-link"
            disabled={link.isPending || linkEvidenceId.trim().length === 0}
            onClick={() => link.mutate(linkEvidenceId.trim())}
          >
            {link.isPending ? "Linking…" : "Link evidence"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)]" data-testid="evidence-link-readonly">
          Linking and unlinking require both control.manage and evidence.manage.
        </p>
      )}

      {successMessage ? (
        <p
          className="text-sm text-[var(--accent)]"
          data-testid="control-evidence-success"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          className="text-sm text-[var(--danger)]"
          data-testid="control-evidence-error"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
