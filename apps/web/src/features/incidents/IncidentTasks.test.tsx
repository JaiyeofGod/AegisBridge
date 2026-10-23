import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { setCsrfToken } from "@/services/csrf";
import type { IncidentTaskRecord } from "@/services/api-types";
import {
  anonymousSessionFixture,
  authenticatedSessionFixture,
  currentUserFixture,
  incidentDetail,
  installApiFetch,
  jsonResponse,
} from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function task(
  partial: Partial<IncidentTaskRecord> & Pick<IncidentTaskRecord, "id" | "title" | "status">,
): IncidentTaskRecord {
  return {
    incident_id: "INC-0001",
    assignee: null,
    completed_at: null,
    created_at: "2026-10-22T12:00:00+00:00",
    updated_at: "2026-10-22T12:00:00+00:00",
    ...partial,
  };
}

const seededTasks: IncidentTaskRecord[] = [
  task({ id: "TASK-0001", title: "Review affected host telemetry", status: "open" }),
  task({
    id: "TASK-0002",
    title: "Validate containment evidence",
    status: "in_progress",
    assignee: { id: "USR-0004", display_name: "Jonah Hale" },
  }),
  task({ id: "TASK-0003", title: "Document recovery verification", status: "open" }),
  task({
    id: "TASK-0004",
    title: "Record lab recovery notes",
    status: "completed",
    completed_at: "2026-10-22T15:00:00+00:00",
    assignee: { id: "USR-0001", display_name: "Amara Okonkwo" },
  }),
  task({ id: "TASK-0005", title: "Retired duplicate check", status: "cancelled" }),
];

function installTasks(
  initial: IncidentTaskRecord[],
  options?: {
    permissions?: string[];
    roles?: string[];
    onPatch?: (body: Record<string, unknown>) => ReturnType<typeof jsonResponse> | undefined;
    onPost?: (body: Record<string, unknown>) => ReturnType<typeof jsonResponse> | undefined;
  },
) {
  let records = initial.map((item) => ({ ...item }));
  let incidentStatus = "investigating";
  let sessionLive = true;
  const user = options?.permissions
    ? {
        ...currentUserFixture,
        permissions: options.permissions,
        roles: options.roles ?? ["SOC Analyst"],
      }
    : null;
  const installed = installApiFetch(
    (url, init) => {
      if (user && url.includes("/api/v1/auth/session")) {
        return jsonResponse(
          sessionLive ? { ...authenticatedSessionFixture, user } : anonymousSessionFixture,
        );
      }
      if (user && url.includes("/api/v1/auth/me")) {
        return sessionLive
          ? jsonResponse(user)
          : jsonResponse({ code: "unauthenticated", message: "Authentication is required." }, 401);
      }
      if (/\/api\/v1\/incidents\/[^/?]+\/tasks/.test(url)) {
        const params = new URL(url, "http://localhost").searchParams;
        if (init?.method === "POST" || init?.method === "PATCH") {
          const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
          if (init.method === "POST" && options?.onPost) {
            const custom = options.onPost(body);
            if (custom) return custom;
          }
          if (init.method === "PATCH" && options?.onPatch) {
            const custom = options.onPatch(body);
            if (custom) return custom;
          }
          if (init.method === "POST") {
            const status = typeof body.status === "string" ? body.status : "open";
            const created = task({
              id: "TASK-0006",
              title: String(body.title ?? ""),
              status,
              completed_at: status === "completed" ? "2026-10-22T16:00:00+00:00" : null,
              updated_at: "2026-10-22T16:00:00+00:00",
            });
            records = [created, ...records];
            return jsonResponse(created);
          }
          const taskId = decodeURIComponent(url.split("/tasks/")[1]?.split("?")[0] ?? "");
          const current = records.find((item) => item.id === taskId);
          if (!current) {
            return jsonResponse({ code: "not_found", message: "Task was not found." }, 404);
          }
          if (
            typeof body.expected_updated_at === "string" &&
            body.expected_updated_at !== current.updated_at
          ) {
            return jsonResponse({ code: "conflict", message: "stale task" }, 409);
          }
          const status = typeof body.status === "string" ? body.status : current.status;
          const next = task({
            ...current,
            title: typeof body.title === "string" ? body.title : current.title,
            status,
            completed_at: status === "completed" ? "2026-10-22T16:30:00+00:00" : null,
            updated_at: "2026-10-22T16:30:00+00:00",
          });
          records = records.map((item) => (item.id === taskId ? next : item));
          return jsonResponse(next);
        }
        let visible = records;
        const status = params.get("status");
        if (status) visible = visible.filter((item) => item.status === status);
        const page = Number(params.get("page") ?? 1);
        const pageSize = Number(params.get("page_size") ?? 25);
        const start = (page - 1) * pageSize;
        return jsonResponse({
          page,
          page_size: pageSize,
          total: visible.length,
          items: visible.slice(start, start + pageSize),
        });
      }
      if (/\/api\/v1\/incidents\/[^/?]+\/?$/.test(url.split("?")[0] ?? "")) {
        if (url.includes("/tasks")) return undefined;
        return jsonResponse({
          ...incidentDetail,
          status: incidentStatus,
          open_task_count: records.filter((item) =>
            ["open", "in_progress", "blocked"].includes(item.status),
          ).length,
          tasks: [],
        });
      }
      return undefined;
    },
    { authenticated: true, allowAuthOverride: Boolean(user) },
  );
  return {
    ...installed,
    records: () => records,
    setIncidentStatus: (status: string) => {
      incidentStatus = status;
    },
    expireSession: () => {
      sessionLive = false;
    },
  };
}

async function openTasks() {
  const user = userEvent.setup();
  await renderWithProviders(<AppRouter />, { initialEntries: ["/incidents"] });
  const page = await screen.findByTestId("incidents-page");
  await user.click(within(page).getByRole("tab", { name: "Tasks" }));
  await screen.findByTestId("incident-tasks");
  await waitFor(() => {
    expect(screen.queryByText("Loading response tasks…")).not.toBeInTheDocument();
  });
  return user;
}

describe("Incident response tasks", () => {
  it("shows task ids, assignee, and completion time without unsupported fields", async () => {
    installTasks(seededTasks);
    await openTasks();
    const panel = screen.getByTestId("incident-tasks");
    expect(within(panel).getByText("TASK-0001")).toBeInTheDocument();
    expect(within(panel).getByText("Review affected host telemetry")).toBeInTheDocument();
    expect(within(panel).getByText("Assigned: Jonah Hale · USR-0004")).toBeInTheDocument();
    expect(within(panel).getByText("Assigned: Amara Okonkwo · USR-0001")).toBeInTheDocument();
    expect(within(panel).getAllByText("Open").length).toBeGreaterThan(0);
    expect(within(panel).getAllByText("In progress").length).toBeGreaterThan(0);
    expect(within(panel).getAllByText("Completed").length).toBeGreaterThan(0);
    expect(within(panel).getAllByText("Cancelled").length).toBeGreaterThan(0);
    expect(within(panel).getByText(/Completed:/)).toBeInTheDocument();
    await waitFor(() => {
      expect(within(panel).getByTestId("task-summary")).toHaveTextContent("3 active · 1 completed");
    });
    expect(panel.textContent ?? "").not.toMatch(UUID);
    expect(within(panel).queryByText(/priority/i)).not.toBeInTheDocument();
    expect(within(panel).queryByText(/\bdue\b/i)).not.toBeInTheDocument();
    expect(within(panel).queryByText(/description/i)).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /delete|remove/i })).not.toBeInTheDocument();
  });

  it("shows the empty state and hides create without incident.manage", async () => {
    installTasks([], { permissions: ["incident.read"], roles: ["Administrator"] });
    await openTasks();
    expect(
      screen.getByText("No response tasks have been created for this incident."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("task-create")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete task/i })).not.toBeInTheDocument();
  });

  it("creates a task with an explicit body and leaves the incident status unchanged", async () => {
    setCsrfToken("task-csrf");
    const api = installTasks(seededTasks.slice(0, 1));
    const user = await openTasks();
    expect(screen.getByTestId("task-incident-status")).toHaveTextContent("Investigating");
    await user.click(screen.getByTestId("task-create"));
    await user.type(screen.getByTestId("task-title"), "Collect simulated host notes");
    await user.click(screen.getByTestId("task-create-submit"));
    expect(await screen.findByTestId("task-success")).toHaveTextContent("Response task created.");
    const postIndex = api.calls.findIndex(
      (url, index) =>
        url.includes("/api/v1/incidents/INC-0001/tasks") && api.inits[index]?.method === "POST",
    );
    expect(postIndex).toBeGreaterThanOrEqual(0);
    const body = JSON.parse(String(api.inits[postIndex]?.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["status", "title"]);
    expect(body).toEqual({ title: "Collect simulated host notes", status: "open" });
    expect(body).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("assignee");
    expect(body).not.toHaveProperty("completed_at");
    expect((api.inits[postIndex]?.headers as Headers).get("X-CSRF-Token")).toBe("task-csrf");
    expect(api.inits[postIndex]?.credentials).toBe("include");
    expect(api.calls.some((url) => url.includes("/api/v1/administration/users"))).toBe(false);
    expect(
      api.calls.some(
        (url, index) =>
          /\/api\/v1\/incidents\/INC-0001$/.test(url.split("?")[0] ?? "") &&
          api.inits[index]?.method === "PATCH",
      ),
    ).toBe(false);
    expect(screen.getByTestId("task-incident-status")).toHaveTextContent("Investigating");
    expect(screen.getByTestId("task-card-TASK-0006")).toHaveAttribute("data-selected", "true");
    expect(localStorage.getItem("csrf_token")).toBeNull();
    expect(sessionStorage.getItem("csrf_token")).toBeNull();
    expect(api.records().some((item) => item.id === "TASK-0006")).toBe(true);
  });

  it("patches title with expected_updated_at and surfaces a 409 reload", async () => {
    setCsrfToken("task-csrf");
    let conflict = true;
    const api = installTasks([seededTasks[0]!], {
      permissions: ["incident.read", "incident.manage"],
      roles: ["SOC Analyst"],
      onPatch: () => {
        if (conflict) {
          conflict = false;
          return jsonResponse({ code: "conflict", message: "stale task" }, 409);
        }
        return undefined;
      },
    });
    const user = await openTasks();
    await user.click(screen.getByRole("button", { name: "Edit TASK-0001" }));
    await user.clear(screen.getByTestId("task-edit-title-TASK-0001"));
    await user.type(screen.getByTestId("task-edit-title-TASK-0001"), "Review lab host telemetry");
    await user.click(screen.getByRole("button", { name: "Save task" }));
    expect(await screen.findByTestId("task-error")).toHaveTextContent(
      "This task changed since you loaded it.",
    );
    expect(screen.getByTestId("task-reload")).toBeInTheDocument();
    expect(screen.getByText("Review affected host telemetry")).toBeInTheDocument();
    const failed = api.inits.find((init) => init?.method === "PATCH");
    const failedBody = JSON.parse(String(failed?.body)) as Record<string, unknown>;
    expect(Object.keys(failedBody).sort()).toEqual(["expected_updated_at", "title"]);
    expect(failedBody.expected_updated_at).toBe(seededTasks[0]?.updated_at);
    expect(failedBody).not.toHaveProperty("assignee");
    expect(failedBody).not.toHaveProperty("completed_at");
    expect(failedBody).not.toHaveProperty("priority");
    const patchesBeforeReload = api.inits.filter((init) => init?.method === "PATCH").length;
    await user.click(screen.getByTestId("task-reload"));
    await waitFor(() => {
      expect(api.calls.filter((url) => url.includes("/tasks?")).length).toBeGreaterThan(1);
    });
    expect(api.inits.filter((init) => init?.method === "PATCH").length).toBe(patchesBeforeReload);
  });

  it("completes, reopens, and cancels without closing the incident or deleting the task", async () => {
    setCsrfToken("task-csrf");
    const api = installTasks([seededTasks[0]!], {
      permissions: ["incident.read", "incident.manage"],
      roles: ["SOC Analyst"],
    });
    const user = await openTasks();
    expect(screen.getByRole("button", { name: "Complete task TASK-0001" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Complete task TASK-0001" }));
    expect(await screen.findByText(/Completed:/)).toBeInTheDocument();
    expect(screen.getByTestId("task-card-TASK-0001")).toBeInTheDocument();
    expect(screen.getByTestId("task-incident-status")).toHaveTextContent("Investigating");
    expect(screen.getByTestId("task-incident-status").textContent?.toLowerCase()).not.toMatch(
      /resolved|closed/,
    );
    const complete = api.inits.find((init) => init?.method === "PATCH");
    expect(JSON.parse(String(complete?.body))).toEqual({
      status: "completed",
      expected_updated_at: seededTasks[0]?.updated_at,
    });

    await user.click(screen.getByRole("button", { name: "Reopen task TASK-0001" }));
    await waitFor(() => {
      expect(screen.queryByText(/Completed:/)).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("task-incident-status")).toHaveTextContent("Investigating");
    const reopen = api.inits.filter((init) => init?.method === "PATCH").at(-1);
    expect(JSON.parse(String(reopen?.body)).status).toBe("open");

    await user.click(screen.getByRole("button", { name: "Cancel task TASK-0001" }));
    expect(screen.getByRole("dialog", { name: "Cancel this response task?" })).toBeInTheDocument();
    expect(api.inits.filter((init) => init?.method === "PATCH")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Confirm cancel TASK-0001" }));
    expect(
      await within(screen.getByTestId("task-card-TASK-0001")).findByText("Cancelled"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("task-card-TASK-0001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete|remove/i })).not.toBeInTheDocument();
    const cancel = api.inits.filter((init) => init?.method === "PATCH").at(-1);
    expect(JSON.parse(String(cancel?.body)).status).toBe("cancelled");
    expect(api.inits.some((init) => init?.method === "DELETE")).toBe(false);
    expect(screen.getByTestId("task-summary")).not.toHaveTextContent(/1 completed/);
  });

  it("keeps assignee read-only and pages and filters on the server", async () => {
    const many = Array.from({ length: 26 }, (_, index) =>
      task({
        id: `TASK-${String(index + 1).padStart(4, "0")}`,
        title: `Simulated task ${index + 1}`,
        status: index === 0 ? "completed" : "open",
        completed_at: index === 0 ? "2026-10-22T15:00:00+00:00" : null,
      }),
    );
    const api = installTasks(many);
    const user = await openTasks();
    expect(screen.queryByRole("combobox", { name: /assignee/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /assignee/i })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(api.calls.some((url) => url.includes("page=1") && url.includes("page_size=25"))).toBe(
        true,
      );
    });
    expect(screen.getByText("TASK-0001")).toBeInTheDocument();
    expect(screen.queryByText("TASK-0026")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("task-pager-next"));
    await screen.findByText("TASK-0026");
    expect(api.calls.some((url) => url.includes("page=2") && url.includes("page_size=25"))).toBe(
      true,
    );
    await user.selectOptions(screen.getByTestId("task-status-filter"), "completed");
    await waitFor(() => {
      expect(
        api.calls.some((url) => url.includes("status=completed") && url.includes("page=1")),
      ).toBe(true);
      expect(screen.queryByText("TASK-0026")).not.toBeInTheDocument();
    });
    expect(screen.getByText("TASK-0001")).toBeInTheDocument();
    expect(screen.queryByText("TASK-0002")).not.toBeInTheDocument();
    expect(api.calls.some((url) => url.includes("/api/v1/administration/users"))).toBe(false);
  });

  it("reports permission, validation, and server failures without fixture rows", async () => {
    setCsrfToken("task-csrf");
    let mode: "403" | "422" | "500" = "403";
    installTasks([seededTasks[0]!], {
      onPatch: () => {
        if (mode === "403") {
          return jsonResponse({ code: "forbidden", message: "Access denied." }, 403);
        }
        if (mode === "422") {
          return jsonResponse({ code: "validation_error", message: "Title is too long." }, 422);
        }
        return jsonResponse({ code: "error", message: "traceback: secret" }, 500);
      },
    });
    const user = await openTasks();
    await user.click(screen.getByRole("button", { name: "Complete task TASK-0001" }));
    expect(await screen.findByTestId("task-error")).toHaveTextContent(
      "You do not have permission to manage incident tasks.",
    );
    expect(screen.queryByText(/traceback/i)).not.toBeInTheDocument();

    mode = "422";
    await user.click(screen.getByRole("button", { name: "Complete task TASK-0001" }));
    expect(await screen.findByTestId("task-error")).toHaveTextContent("Title is too long.");

    mode = "500";
    await user.click(screen.getByRole("button", { name: "Complete task TASK-0001" }));
    expect(await screen.findByTestId("task-error")).toHaveTextContent(
      "Unable to update the response task right now.",
    );
    expect(screen.queryByText(/traceback/i)).not.toBeInTheDocument();
    expect(screen.queryByText("TASK-201")).not.toBeInTheDocument();
  });

  it("shows a load error instead of fixture tasks", async () => {
    installApiFetch((url) => {
      if (/\/api\/v1\/incidents\/[^/?]+\/tasks/.test(url)) {
        return jsonResponse({ message: "down" }, 500);
      }
      return undefined;
    });
    await openTasks();
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load response tasks.");
    expect(screen.queryByText("TASK-201")).not.toBeInTheDocument();
    expect(screen.queryByText("Review affected host telemetry")).not.toBeInTheDocument();
  });
});
