import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { CatalogPager } from "@/components/navigation/CatalogPager";
import { StatusBadge } from "@/components/status/StatusBadge";
import { useAuthActions, useAuthStatus } from "@/features/auth/useAuthSession";
import { formatTimestamp } from "@/lib/format";
import { ApiError } from "@/services/api-client";
import type {
  IncidentTaskRecord,
  IncidentTaskStatusValue,
  IncidentTaskUpdate,
  PersonRef,
} from "@/services/api-types";
import { createIncidentTask, fetchIncidentTasks, updateIncidentTask } from "@/services/incidents";

const PAGE_SIZE = 25;

const TASK_STATUSES = [
  "open",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
] as const satisfies readonly IncidentTaskStatusValue[];

const ACTIVE_STATUSES = new Set<IncidentTaskStatusValue>(["open", "in_progress", "blocked"]);

const STATUS_LABEL: Record<IncidentTaskStatusValue, string> = {
  open: "Open",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_TONE = {
  open: "accent",
  in_progress: "warning",
  blocked: "critical",
  completed: "success",
  cancelled: "neutral",
} as const;

type StatusFilter = "all" | IncidentTaskStatusValue;

type Props = {
  incidentId: string;
  incidentStatus: string;
  openTaskCount: number;
};

const fieldClass =
  "mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]";

function isTaskStatus(value: string): value is IncidentTaskStatusValue {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

function statusLabel(value: string) {
  return isTaskStatus(value) ? STATUS_LABEL[value] : value;
}

function assigneeLabel(assignee: PersonRef | null) {
  if (!assignee) return "Unassigned";
  return `${assignee.display_name} · ${assignee.id}`;
}

export function IncidentTasksPanel({ incidentId, incidentStatus, openTaskCount }: Props) {
  const queryClient = useQueryClient();
  const auth = useAuthStatus();
  const { handleAccountUnauthorized } = useAuthActions();
  const canManage = auth.user?.permissions.includes("incident.manage") === true;
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftStatus, setDraftStatus] = useState<IncidentTaskStatusValue>("open");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStatus, setEditStatus] = useState<IncidentTaskStatusValue>("open");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const query = {
    page,
    pageSize: PAGE_SIZE,
    ...(statusFilter === "all" ? {} : { status: statusFilter }),
  };
  const tasks = useQuery({
    queryKey: ["incidents", "tasks", incidentId, query],
    queryFn: () => fetchIncidentTasks(incidentId, query),
    enabled: incidentId.length > 0,
    retry: false,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    setPage(1);
    setStatusFilter("all");
    setSelectedId(null);
    setCreating(false);
    setEditingId(null);
    setCancelId(null);
    setConflict(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [incidentId]);

  useEffect(() => {
    if (tasks.error instanceof ApiError && tasks.error.status === 401) {
      void handleAccountUnauthorized(tasks.error);
    }
  }, [tasks.error, handleAccountUnauthorized]);

  async function refreshTaskViews() {
    await queryClient.invalidateQueries({ queryKey: ["incidents", "tasks", incidentId] });
    await queryClient.invalidateQueries({ queryKey: ["incidents", "detail", incidentId] });
    await queryClient.invalidateQueries({ queryKey: ["incidents", "list"] });
  }

  function reportMutationError(error: unknown) {
    if (error instanceof ApiError) {
      if (error.status === 409) {
        setConflict(true);
        setErrorMessage("This task changed since you loaded it.");
        return;
      }
      if (error.status === 403) {
        setErrorMessage("You do not have permission to manage incident tasks.");
        return;
      }
      if (error.status === 404) {
        setErrorMessage("This incident or task no longer exists.");
        void refreshTaskViews();
        return;
      }
      if (error.status === 422) {
        setErrorMessage(error.message || "Task values are invalid.");
        return;
      }
      if (error.status >= 500) {
        setErrorMessage("Unable to update the response task right now.");
        return;
      }
      setErrorMessage(error.message || "Unable to update the response task right now.");
      return;
    }
    setErrorMessage("Unable to update the response task right now.");
  }

  const createTask = useMutation({
    mutationFn: () =>
      createIncidentTask(incidentId, {
        title: draftTitle.trim(),
        status: draftStatus,
      }),
    onSuccess: async (record) => {
      setSuccessMessage("Response task created.");
      setErrorMessage(null);
      setConflict(false);
      setCreating(false);
      setDraftTitle("");
      setDraftStatus("open");
      setStatusFilter("all");
      setPage(1);
      setSelectedId(record.id);
      await refreshTaskViews();
    },
    onError: async (error) => {
      setSuccessMessage(null);
      if (await handleAccountUnauthorized(error)) return;
      reportMutationError(error);
    },
  });

  const saveTask = useMutation({
    mutationFn: (input: { taskId: string; patch: IncidentTaskUpdate }) =>
      updateIncidentTask(incidentId, input.taskId, input.patch),
    onSuccess: async (record) => {
      setSuccessMessage("Response task saved.");
      setErrorMessage(null);
      setConflict(false);
      setEditingId(null);
      setCancelId(null);
      setSelectedId(record.id);
      await refreshTaskViews();
    },
    onError: async (error) => {
      setSuccessMessage(null);
      if (await handleAccountUnauthorized(error)) return;
      reportMutationError(error);
    },
  });

  const items = tasks.data?.items ?? [];
  const total = tasks.data?.total ?? 0;
  const pageCoversAll = statusFilter === "all" && tasks.data !== undefined && total <= items.length;
  const completedCount = pageCoversAll
    ? items.filter((item) => item.status === "completed").length
    : null;
  const showSummary = total > 0 || openTaskCount > 0;

  function beginEdit(task: IncidentTaskRecord) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditStatus(isTaskStatus(task.status) ? task.status : "open");
    setCancelId(null);
    setSuccessMessage(null);
    setErrorMessage(null);
    setConflict(false);
    setSelectedId(task.id);
  }

  function submitEdit(task: IncidentTaskRecord) {
    const patch: IncidentTaskUpdate = {};
    const title = editTitle.trim();
    if (title !== task.title) patch.title = title;
    if (editStatus !== task.status) patch.status = editStatus;
    if (Object.keys(patch).length === 0) {
      setSuccessMessage(null);
      setErrorMessage("No task changes to save.");
      return;
    }
    patch.expected_updated_at = task.updated_at;
    saveTask.mutate({ taskId: task.id, patch });
  }

  function sendStatus(task: IncidentTaskRecord, status: IncidentTaskStatusValue) {
    saveTask.mutate({
      taskId: task.id,
      patch: { status, expected_updated_at: task.updated_at },
    });
  }

  return (
    <div className="space-y-4" data-testid="incident-tasks">
      <p className="text-sm text-[var(--text)]" data-testid="task-incident-status">
        Incident status: {incidentStatus}. Task status does not automatically change the incident
        status.
      </p>
      <p className="text-xs text-[var(--muted)]">
        Assignee stays read-only. A safe operational user list is not available on this page.
      </p>
      {showSummary ? (
        <p className="text-sm font-semibold text-[var(--text)]" data-testid="task-summary">
          Response tasks
          <span className="mt-1 block font-normal text-[var(--muted)]">
            {openTaskCount} active
            {completedCount !== null ? ` · ${completedCount} completed` : ""}
          </span>
        </p>
      ) : null}
      {tasks.isPending ? (
        <p className="text-sm text-[var(--muted)]">Loading response tasks…</p>
      ) : null}
      {tasks.isFetching && !tasks.isPending ? (
        <p className="text-xs text-[var(--muted)]">Updating tasks…</p>
      ) : null}
      {tasks.isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-[var(--text)]">Unable to load response tasks.</p>
          <Button type="button" variant="secondary" onClick={() => void tasks.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}
      {successMessage ? (
        <p className="text-sm text-[var(--text)]" data-testid="task-success" role="status">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <div role="alert" data-testid="task-error" className="space-y-2">
          <p className="text-sm text-[var(--text)]">{errorMessage}</p>
          {conflict ? (
            <Button
              type="button"
              variant="secondary"
              data-testid="task-reload"
              onClick={() => {
                setConflict(false);
                setErrorMessage(null);
                void refreshTaskViews();
              }}
            >
              Reload
            </Button>
          ) : null}
        </div>
      ) : null}

      {canManage ? (
        creating ? (
          <form
            className="space-y-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-3"
            aria-label="Create response task"
            onSubmit={(event) => {
              event.preventDefault();
              setErrorMessage(null);
              setSuccessMessage(null);
              if (draftTitle.trim().length === 0) {
                setErrorMessage("Task title is required.");
                return;
              }
              createTask.mutate();
            }}
          >
            <label className="block text-xs text-[var(--muted)]">
              Task title
              <input
                className={fieldClass}
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                data-testid="task-title"
                required
              />
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Initial status
              <select
                className={fieldClass}
                value={draftStatus}
                onChange={(event) => setDraftStatus(event.target.value as IncidentTaskStatusValue)}
                data-testid="task-initial-status"
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={createTask.isPending}
                data-testid="task-create-submit"
              >
                {createTask.isPending ? "Creating…" : "Create task"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setCreating(false);
                  setDraftTitle("");
                  setDraftStatus("open");
                }}
              >
                Close
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" data-testid="task-create" onClick={() => setCreating(true)}>
            Create task
          </Button>
        )
      ) : null}

      <label className="block text-xs text-[var(--muted)]">
        Filter by status
        <select
          className={fieldClass}
          value={statusFilter}
          data-testid="task-status-filter"
          onChange={(event) => {
            setStatusFilter(event.target.value as StatusFilter);
            setPage(1);
          }}
        >
          <option value="all">All</option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </label>

      {tasks.isSuccess && total === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No response tasks have been created for this incident.
        </p>
      ) : null}

      <ul className="space-y-3" aria-label="Response tasks">
        {items.map((task) => {
          const active = isTaskStatus(task.status) && ACTIVE_STATUSES.has(task.status);
          const selected = selectedId === task.id;
          return (
            <li
              key={task.id}
              data-testid={`task-card-${task.id}`}
              data-selected={selected ? "true" : "false"}
              className={
                selected
                  ? "rounded-[var(--radius-control)] border border-[var(--accent)] bg-[var(--raised)] px-4 py-3"
                  : "rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
              }
            >
              <h3 className="font-medium text-[var(--text)]">{task.id}</h3>
              <p className="mt-1 text-sm text-[var(--text)]">{task.title}</p>
              <p className="mt-2 text-sm text-[var(--text)]">
                Status:{" "}
                <StatusBadge
                  label={statusLabel(task.status)}
                  tone={isTaskStatus(task.status) ? STATUS_TONE[task.status] : "neutral"}
                />
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Assigned: {assigneeLabel(task.assignee)}
              </p>
              {task.completed_at ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Completed: {formatTimestamp(task.completed_at)}
                </p>
              ) : null}
              <p className="mt-1 text-sm text-[var(--muted)]">
                Updated: {formatTimestamp(task.updated_at)}
              </p>
              {canManage ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={`Edit ${task.id}`}
                    onClick={() => beginEdit(task)}
                  >
                    Edit
                  </Button>
                  {active ? (
                    <Button
                      type="button"
                      aria-label={`Complete task ${task.id}`}
                      disabled={saveTask.isPending}
                      onClick={() => sendStatus(task, "completed")}
                    >
                      Complete task
                    </Button>
                  ) : null}
                  {active ? (
                    <Button
                      type="button"
                      variant="secondary"
                      aria-label={`Cancel task ${task.id}`}
                      onClick={() => {
                        setCancelId(task.id);
                        setEditingId(null);
                        setSelectedId(task.id);
                      }}
                    >
                      Cancel task
                    </Button>
                  ) : null}
                  {task.status === "completed" || task.status === "cancelled" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      aria-label={`Reopen task ${task.id}`}
                      disabled={saveTask.isPending}
                      onClick={() => sendStatus(task, "open")}
                    >
                      Reopen task
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {task.status === "completed" && canManage ? (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Reopening clears the completion timestamp on the server.
                </p>
              ) : null}
              {editingId === task.id ? (
                <form
                  className="mt-3 space-y-3"
                  aria-label={`Edit ${task.id}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitEdit(task);
                  }}
                >
                  <label className="block text-xs text-[var(--muted)]">
                    Task title
                    <input
                      className={fieldClass}
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      data-testid={`task-edit-title-${task.id}`}
                    />
                  </label>
                  <label className="block text-xs text-[var(--muted)]">
                    Task status
                    <select
                      className={fieldClass}
                      value={editStatus}
                      onChange={(event) =>
                        setEditStatus(event.target.value as IncidentTaskStatusValue)
                      }
                      data-testid={`task-edit-status-${task.id}`}
                    >
                      {TASK_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABEL[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button type="submit" disabled={saveTask.isPending}>
                    {saveTask.isPending ? "Saving…" : "Save task"}
                  </Button>
                </form>
              ) : null}
              {cancelId === task.id ? (
                <div
                  className="mt-3 space-y-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] p-3"
                  role="dialog"
                  aria-labelledby={`cancel-heading-${task.id}`}
                  data-testid={`task-cancel-dialog-${task.id}`}
                >
                  <h4
                    id={`cancel-heading-${task.id}`}
                    className="text-sm font-semibold text-[var(--text)]"
                  >
                    Cancel this response task?
                  </h4>
                  <p className="text-sm text-[var(--muted)]">
                    The task remains in incident history. It is not deleted. Cancellation does not
                    close the incident.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      aria-label={`Confirm cancel ${task.id}`}
                      disabled={saveTask.isPending}
                      onClick={() => sendStatus(task, "cancelled")}
                    >
                      Confirm cancel
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setCancelId(null)}>
                      Keep task
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {tasks.data && total > PAGE_SIZE ? (
        <CatalogPager
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          disabled={tasks.isFetching}
          label="response tasks"
          testIdPrefix="task-pager"
        />
      ) : null}
    </div>
  );
}
