import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { labSystemRelationshipsKey } from "@/features/cyber-range/useCyberRangeData";
import type {
  LabSystemRelationshipView,
  LabSystemView,
} from "@/features/cyber-range/mapCyberRange";
import { ApiError } from "@/services/api-client";
import {
  createLabSystemRelationship,
  deleteLabSystemRelationship,
  updateLabSystemRelationship,
} from "@/services/cyber-range";
import { catalogRelationshipKinds, type CatalogRelationshipKind } from "@/types/cyber-range";

const kindLabel: Record<CatalogRelationshipKind, string> = {
  connected_to: "Connected to",
  depends_on: "Depends on",
  manages: "Manages",
  monitors: "Monitors",
};

const kindVerb: Record<CatalogRelationshipKind, string> = {
  connected_to: "connected to",
  depends_on: "depends on",
  manages: "manages",
  monitors: "monitors",
};

const fieldClass =
  "min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

type EditorState = { mode: "create" } | { mode: "edit"; relationship: LabSystemRelationshipView };

export function CatalogRelationshipManager({
  canManage,
  systems,
  relationships,
  selectedSystemId,
}: {
  canManage: boolean;
  systems: LabSystemView[];
  relationships: LabSystemRelationshipView[];
  selectedSystemId: string;
}) {
  const queryClient = useQueryClient();
  const returnFocus = useRef<HTMLElement | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LabSystemRelationshipView | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const touching = relationships.filter(
    (item) => item.sourceSystemId === selectedSystemId || item.targetSystemId === selectedSystemId,
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: labSystemRelationshipsKey });
  };

  const save = useMutation({
    mutationFn: async (input: { editor: EditorState; body: RelationshipBody }) => {
      if (input.editor.mode === "create") return createLabSystemRelationship(input.body);
      return updateLabSystemRelationship(input.editor.relationship.id, input.body);
    },
    onSuccess: async (_result, input) => {
      await refresh();
      setEditor(null);
      setStatusMessage(
        input.editor.mode === "create"
          ? "Catalog relationship saved."
          : "Catalog relationship updated.",
      );
    },
  });

  const remove = useMutation({
    mutationFn: (relationship: LabSystemRelationshipView) =>
      deleteLabSystemRelationship(relationship.id),
    onSuccess: async () => {
      await refresh();
      setPendingDelete(null);
      setStatusMessage("Catalog relationship removed.");
    },
  });

  if (!canManage) return null;

  function rememberFocus() {
    if (document.activeElement instanceof HTMLElement) {
      returnFocus.current = document.activeElement;
    }
  }

  function restoreFocus(event: Event) {
    event.preventDefault();
    returnFocus.current?.focus();
  }

  function openCreate() {
    rememberFocus();
    save.reset();
    setStatusMessage(null);
    setEditor({ mode: "create" });
  }

  return (
    <div className="mt-3 space-y-2">
      {statusMessage ? (
        <p className="text-sm text-[var(--text)]" role="status">
          {statusMessage}
        </p>
      ) : null}
      <Button type="button" variant="secondary" onClick={() => openCreate()}>
        Add catalog relationship
      </Button>
      {touching.length > 0 ? (
        <ul className="space-y-2">
          {touching.map((item) => (
            <li key={item.id} className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  rememberFocus();
                  setStatusMessage(null);
                  setEditor({ mode: "edit", relationship: item });
                }}
              >
                Edit {item.id}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  rememberFocus();
                  setStatusMessage(null);
                  setPendingDelete(item);
                }}
              >
                Remove {item.id}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <RelationshipDialog
        editor={editor}
        systems={systems}
        selectedSystemId={selectedSystemId}
        pending={save.isPending}
        errorMessage={save.error instanceof ApiError ? save.error.message : null}
        onClose={() => {
          save.reset();
          setEditor(null);
        }}
        onSubmit={(body) => {
          if (!editor) return;
          save.mutate({ editor, body });
        }}
        onCloseAutoFocus={restoreFocus}
      />
      <DeleteDialog
        relationship={pendingDelete}
        pending={remove.isPending}
        errorMessage={remove.error instanceof ApiError ? remove.error.message : null}
        onClose={() => {
          remove.reset();
          setPendingDelete(null);
        }}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete);
        }}
        onCloseAutoFocus={restoreFocus}
      />
    </div>
  );
}

type RelationshipBody = {
  source_system_id: string;
  target_system_id: string;
  relationship_kind: CatalogRelationshipKind;
};

function RelationshipDialog({
  editor,
  systems,
  selectedSystemId,
  pending,
  errorMessage,
  onClose,
  onSubmit,
  onCloseAutoFocus,
}: {
  editor: EditorState | null;
  systems: LabSystemView[];
  selectedSystemId: string;
  pending: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (body: RelationshipBody) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const initial = initialBody(editor, systems, selectedSystemId);
  return (
    <Dialog.Root
      open={editor !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          className="motion-dialog fixed top-1/2 left-1/2 z-50 max-h-[calc(100%-2rem)] w-[min(100%-2rem,28rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-4 outline-none"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          {editor && initial ? (
            <RelationshipForm
              key={`${editor.mode}-${editor.mode === "edit" ? editor.relationship.id : "new"}`}
              title={
                editor.mode === "create" ? "Add catalog relationship" : "Edit catalog relationship"
              }
              initial={initial}
              systems={systems}
              pending={pending}
              errorMessage={errorMessage}
              onSubmit={onSubmit}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RelationshipForm({
  title,
  initial,
  systems,
  pending,
  errorMessage,
  onSubmit,
}: {
  title: string;
  initial: RelationshipBody;
  systems: LabSystemView[];
  pending: boolean;
  errorMessage: string | null;
  onSubmit: (body: RelationshipBody) => void;
}) {
  const [sourceId, setSourceId] = useState(initial.source_system_id);
  const [targetId, setTargetId] = useState(initial.target_system_id);
  const [kind, setKind] = useState<CatalogRelationshipKind>(initial.relationship_kind);
  const sameSystem = sourceId.length > 0 && sourceId === targetId;

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (sameSystem || !isCatalogKind(kind)) return;
        onSubmit({
          source_system_id: sourceId,
          target_system_id: targetId,
          relationship_kind: kind,
        });
      }}
    >
      <Dialog.Title className="font-heading text-lg text-[var(--text)]">{title}</Dialog.Title>
      <Dialog.Description className="text-sm text-[var(--muted)]">
        This records a documented catalog relationship. It does not detect network connectivity,
        live traffic, or an attack path.
      </Dialog.Description>
      <label className="block text-sm font-medium text-[var(--text)]" htmlFor="catalog-source">
        Source system
        <select
          id="catalog-source"
          className={`${fieldClass} mt-1`}
          value={sourceId}
          onChange={(event) => setSourceId(event.target.value)}
        >
          {systems.map((system) => (
            <option key={system.id} value={system.id}>
              {system.id} · {system.hostname}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-[var(--text)]" htmlFor="catalog-kind">
        Relationship kind
        <select
          id="catalog-kind"
          className={`${fieldClass} mt-1`}
          value={kind}
          onChange={(event) => {
            if (isCatalogKind(event.target.value)) setKind(event.target.value);
          }}
        >
          {catalogRelationshipKinds.map((value) => (
            <option key={value} value={value}>
              {kindLabel[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-[var(--text)]" htmlFor="catalog-target">
        Target system
        <select
          id="catalog-target"
          className={`${fieldClass} mt-1`}
          value={targetId}
          aria-invalid={sameSystem}
          aria-describedby={sameSystem ? "catalog-same-system" : undefined}
          onChange={(event) => setTargetId(event.target.value)}
        >
          {systems.map((system) => (
            <option key={system.id} value={system.id}>
              {system.id} · {system.hostname}
            </option>
          ))}
        </select>
      </label>
      {sameSystem ? (
        <p id="catalog-same-system" className="text-sm text-[var(--text)]" role="alert">
          Source and target must be different systems.
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-[var(--text)]" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || sameSystem || systems.length < 2}>
          {pending ? "Saving…" : "Save catalog relationship"}
        </Button>
        <Dialog.Close asChild>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Dialog.Close>
      </div>
    </form>
  );
}

function DeleteDialog({
  relationship,
  pending,
  errorMessage,
  onClose,
  onConfirm,
  onCloseAutoFocus,
}: {
  relationship: LabSystemRelationshipView | null;
  pending: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  return (
    <Dialog.Root
      open={relationship !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          className="motion-dialog fixed top-1/2 left-1/2 z-50 w-[min(100%-2rem,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-4 outline-none"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          {relationship ? (
            <>
              <Dialog.Title className="font-heading text-lg text-[var(--text)]">
                {`Remove catalog relationship ${relationship.sourceSystemId} ${kindVerb[relationship.kind]} ${relationship.targetSystemId}?`}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-[var(--muted)]">
                This removes only the documented catalog association. It does not delete either
                system, change telemetry, affect Wazuh, or change actual connectivity.
              </Dialog.Description>
              {errorMessage ? (
                <p className="mt-2 text-sm text-[var(--text)]" role="alert">
                  {errorMessage}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="danger" disabled={pending} onClick={onConfirm}>
                  {pending ? "Removing…" : "Confirm remove"}
                </Button>
                <Dialog.Close asChild>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </Dialog.Close>
              </div>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function initialBody(
  editor: EditorState | null,
  systems: LabSystemView[],
  selectedSystemId: string,
): RelationshipBody | null {
  if (!editor || systems.length === 0) return null;
  if (editor.mode === "edit") {
    return {
      source_system_id: editor.relationship.sourceSystemId,
      target_system_id: editor.relationship.targetSystemId,
      relationship_kind: editor.relationship.kind,
    };
  }
  const source = systems.some((system) => system.id === selectedSystemId)
    ? selectedSystemId
    : systems[0].id;
  const target = systems.find((system) => system.id !== source)?.id ?? source;
  return {
    source_system_id: source,
    target_system_id: target,
    relationship_kind: "monitors",
  };
}

function isCatalogKind(value: string): value is CatalogRelationshipKind {
  return (catalogRelationshipKinds as readonly string[]).includes(value);
}
