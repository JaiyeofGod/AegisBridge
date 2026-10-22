import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { formatBytes } from "@/features/governance/formatBytes";
import { invalidateGovernanceWrites } from "@/features/governance/governance-mutations";
import { formatTimestamp } from "@/lib/format";
import { ApiError } from "@/services/api-client";
import type { EvidenceDetail } from "@/services/api-types";
import { EVIDENCE_MAX_UPLOAD_BYTES } from "@/services/api-types";
import {
  deleteEvidenceObject,
  downloadEvidenceObject,
  fetchEvidence,
  uploadEvidenceObject,
} from "@/services/governance";

type Props = {
  evidenceId: string;
  controlId: string;
  canReadEvidence: boolean;
  canManageEvidence: boolean;
  /** Seed from create response until the detail query returns. */
  seed?: EvidenceDetail | null;
  onDetailChange?: (detail: EvidenceDetail) => void;
};

function storageUnavailableMessage(error: ApiError): string {
  if (error.status >= 500 || error.code === "storage_unavailable") {
    return "Evidence storage is temporarily unavailable.";
  }
  return error.message;
}

export function EvidenceObjectPanel({
  evidenceId,
  controlId,
  canReadEvidence,
  canManageEvidence,
  seed = null,
  onDetailChange,
}: Props) {
  const queryClient = useQueryClient();
  const { handleAccountUnauthorized } = useAuthActions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const uploadInFlight = useRef(false);

  const detailQuery = useQuery({
    queryKey: ["evidence", "detail", evidenceId],
    queryFn: () => fetchEvidence(evidenceId),
    enabled: canReadEvidence || canManageEvidence,
    initialData: seed ?? undefined,
  });

  const detail = detailQuery.data ?? seed;
  const objectStored = detail?.object_stored === true;

  const upload = useMutation({
    mutationFn: async (file: File) => uploadEvidenceObject(evidenceId, file),
    onSuccess: async (updated) => {
      uploadInFlight.current = false;
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setStatusMessage(
        `Stored ${updated.original_filename ?? "file"}. SHA-256 was calculated by AegisBridge when the file was stored.`,
      );
      setErrorMessage(null);
      onDetailChange?.(updated);
      queryClient.setQueryData(["evidence", "detail", evidenceId], updated);
      await invalidateGovernanceWrites(queryClient, { controlId, evidenceId });
    },
    onError: async (error) => {
      uploadInFlight.current = false;
      setStatusMessage(null);
      if (await handleAccountUnauthorized(error)) {
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setErrorMessage("You do not have permission to upload evidence objects.");
          return;
        }
        if (error.status === 404) {
          setErrorMessage("Evidence was not found.");
          return;
        }
        if (error.status === 409) {
          setErrorMessage("This evidence record already has a stored object.");
          await detailQuery.refetch();
          return;
        }
        if (error.status === 413) {
          setErrorMessage("The file is too large for evidence storage.");
          return;
        }
        if (error.status === 422) {
          setErrorMessage(error.message || "The file could not be accepted.");
          return;
        }
        setErrorMessage(storageUnavailableMessage(error));
        return;
      }
      setErrorMessage("Evidence storage is temporarily unavailable.");
    },
  });

  const download = useMutation({
    mutationFn: async () => downloadEvidenceObject(evidenceId),
    onSuccess: () => {
      setStatusMessage("Download started.");
      setErrorMessage(null);
    },
    onError: async (error) => {
      setStatusMessage(null);
      if (await handleAccountUnauthorized(error)) {
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setErrorMessage("You do not have permission to download this evidence object.");
          return;
        }
        if (error.status === 404) {
          setErrorMessage("No stored object was found for this evidence.");
          return;
        }
        setErrorMessage(storageUnavailableMessage(error));
        return;
      }
      setErrorMessage("Evidence storage is temporarily unavailable.");
    },
  });

  const removeObject = useMutation({
    mutationFn: async () => deleteEvidenceObject(evidenceId),
    onSuccess: async () => {
      setConfirmDelete(false);
      setStatusMessage(
        "Stored file deleted. The evidence metadata record and control links remain.",
      );
      setErrorMessage(null);
      const refreshed = await fetchEvidence(evidenceId);
      onDetailChange?.(refreshed);
      queryClient.setQueryData(["evidence", "detail", evidenceId], refreshed);
      await invalidateGovernanceWrites(queryClient, { controlId, evidenceId });
    },
    onError: async (error) => {
      setStatusMessage(null);
      if (await handleAccountUnauthorized(error)) {
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setErrorMessage("You do not have permission to delete stored evidence objects.");
          return;
        }
        if (error.status === 404) {
          setErrorMessage("No stored object was found for this evidence.");
          return;
        }
        setErrorMessage(storageUnavailableMessage(error));
        return;
      }
      setErrorMessage("Evidence storage is temporarily unavailable.");
    },
  });

  function onFileChosen(file: File | null) {
    setErrorMessage(null);
    setStatusMessage(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size === 0) {
      setSelectedFile(file);
      setErrorMessage("Selected file is empty (0 bytes). You can still upload if intentional.");
      return;
    }
    if (file.size > EVIDENCE_MAX_UPLOAD_BYTES) {
      setSelectedFile(file);
      setErrorMessage(
        `Selected file is ${formatBytes(file.size)}. Maximum size enforced by server is about ${formatBytes(EVIDENCE_MAX_UPLOAD_BYTES)}.`,
      );
      return;
    }
    setSelectedFile(file);
  }

  function startUpload() {
    if (!selectedFile || upload.isPending || uploadInFlight.current) {
      return;
    }
    if (selectedFile.size > EVIDENCE_MAX_UPLOAD_BYTES) {
      setErrorMessage(
        `Selected file is too large. Maximum size enforced by server is about ${formatBytes(EVIDENCE_MAX_UPLOAD_BYTES)}.`,
      );
      return;
    }
    uploadInFlight.current = true;
    setErrorMessage(null);
    upload.mutate(selectedFile);
  }

  if (!canReadEvidence && !canManageEvidence) {
    return (
      <p className="text-xs text-[var(--muted)]" data-testid="evidence-object-no-access">
        Viewing stored evidence objects requires evidence.read.
      </p>
    );
  }

  if (detailQuery.isLoading && !detail) {
    return (
      <p className="text-sm text-[var(--muted)]" data-testid="evidence-object-loading">
        Loading evidence object state…
      </p>
    );
  }

  if (detailQuery.isError && !detail) {
    return (
      <p
        className="text-sm text-[var(--danger)]"
        data-testid="evidence-object-load-error"
        role="alert"
      >
        Evidence detail could not be loaded.
      </p>
    );
  }

  return (
    <div
      className="space-y-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] p-3"
      data-testid={`evidence-object-panel-${evidenceId}`}
    >
      <div className="space-y-1">
        <h5 className="font-heading text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Private stored file
        </h5>
        <p className="text-xs text-[var(--muted)]" data-testid="evidence-object-malware-note">
          Files are stored as opaque evidence objects. Malware scanning is not enabled in this
          development phase.
        </p>
      </div>

      {objectStored && detail ? (
        <dl
          className="grid gap-2 text-sm text-[var(--text)] sm:grid-cols-2"
          data-testid={`evidence-object-metadata-${evidenceId}`}
        >
          <div>
            <dt className="text-xs text-[var(--muted)]">Filename</dt>
            <dd data-testid="evidence-object-filename">
              {detail.original_filename ?? detail.title}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Size</dt>
            <dd data-testid="evidence-object-size">
              {detail.size_bytes != null ? formatBytes(detail.size_bytes) : "unknown"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-[var(--muted)]">SHA-256</dt>
            <dd className="break-all font-mono text-xs" data-testid="evidence-object-sha256">
              {detail.sha256 ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Content type</dt>
            <dd data-testid="evidence-object-content-type">
              {detail.content_type ?? detail.mime_type ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Stored</dt>
            <dd data-testid="evidence-object-stored-at">
              {detail.stored_at ? formatTimestamp(detail.stored_at) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Storage state</dt>
            <dd data-testid="evidence-object-stored-flag">object_stored=true</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Integrity</dt>
            <dd data-testid="evidence-object-integrity">
              integrity_verified={String(detail.integrity_verified)}
              {detail.hash_source ? ` · ${detail.hash_source}` : ""}
            </dd>
          </div>
          <p
            className="sm:col-span-2 text-xs text-[var(--muted)]"
            data-testid="evidence-object-hash-copy"
          >
            SHA-256 was calculated by AegisBridge when the file was stored. This is not an
            independent integrity re-verification.
          </p>
        </dl>
      ) : (
        <p className="text-sm text-[var(--muted)]" data-testid="evidence-object-absent">
          No private file is stored for this evidence record yet.
        </p>
      )}

      {!objectStored && canManageEvidence ? (
        <div className="space-y-2" data-testid="evidence-file-upload">
          <label className="block text-xs text-[var(--muted)]">
            Select one file
            <input
              ref={fileInputRef}
              type="file"
              className="mt-1 block w-full text-sm text-[var(--text)]"
              data-testid="evidence-file-input"
              disabled={upload.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                onFileChosen(file);
              }}
            />
          </label>
          {selectedFile ? (
            <p className="text-xs text-[var(--text)]" data-testid="evidence-file-selected">
              {selectedFile.name} · {formatBytes(selectedFile.size)}
            </p>
          ) : null}
          <p className="text-xs text-[var(--muted)]" data-testid="evidence-upload-max-copy">
            Maximum size enforced by server (development default{" "}
            {formatBytes(EVIDENCE_MAX_UPLOAD_BYTES)}).
          </p>
          <Button
            type="button"
            data-testid="evidence-upload"
            disabled={
              !selectedFile ||
              upload.isPending ||
              (selectedFile != null && selectedFile.size > EVIDENCE_MAX_UPLOAD_BYTES)
            }
            onClick={startUpload}
          >
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </div>
      ) : null}

      {objectStored ? (
        <div className="flex flex-wrap gap-2">
          {canReadEvidence ? (
            <Button
              type="button"
              variant="secondary"
              data-testid="evidence-download"
              disabled={download.isPending}
              onClick={() => download.mutate()}
            >
              {download.isPending ? "Downloading…" : "Download"}
            </Button>
          ) : null}
          {canManageEvidence ? (
            confirmDelete ? (
              <div className="flex w-full flex-wrap items-start gap-2">
                <Button
                  type="button"
                  data-testid="evidence-object-delete-confirm"
                  disabled={removeObject.isPending}
                  onClick={() => removeObject.mutate()}
                >
                  {removeObject.isPending ? "Deleting…" : "Confirm delete stored file"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="evidence-object-delete-cancel"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
                <p
                  className="w-full text-xs text-[var(--muted)]"
                  data-testid="evidence-object-delete-copy"
                >
                  Delete stored file removes object bytes only. It does not delete the evidence
                  metadata record or control links.
                </p>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                data-testid="evidence-object-delete"
                onClick={() => {
                  setConfirmDelete(true);
                  setStatusMessage(null);
                  setErrorMessage(null);
                }}
              >
                Delete stored file
              </Button>
            )
          ) : null}
        </div>
      ) : null}

      {statusMessage ? (
        <p
          className="text-sm text-[var(--accent)]"
          data-testid="evidence-object-success"
          role="status"
        >
          {statusMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          className="text-sm text-[var(--danger)]"
          data-testid="evidence-object-error"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
