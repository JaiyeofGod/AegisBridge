import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { setCsrfToken } from "@/services/csrf";
import type { DirectoryUser, IncidentTaskRecord } from "@/services/api-types";
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

const directoryUsers: DirectoryUser[] = [
  {
    id: "USR-0001",
    display_name: "Amara Okonkwo",
    account_status: "active",
    department: "Security",
    job_title: "Security administrator",
  },
  {
    id: "USR-0002",
    display_name: "Nia Okeke",
    account_status: "active",
    department: "Security",
    job_title: "Security Engineer",
  },
  {
    id: "USR-0004",
    display_name: "Jonah Hale",
    account_status: "active",
    department: "Security",
    job_title: "SOC analyst",
  },
  ...Array.from({ length: 18 }, (_, index) => ({
    id: `USR-${String(index + 5).padStart(4, "0")}`,
    display_name: `Directory User ${index + 5}`,
    account_status: "active",
    department: null,
    job_title: null,
  })),
];

const ASSIGNEE_NAMES: Record<string, string> = Object.fromEntries(
  directoryUsers.map((user) => [user.id, user.display_name]),
);

function assigneeFromBody(body: Record<string, unknown>) {
  if (typeof body.assignee !== "string" || body.assignee.trim().length === 0) return null;
  const id = body.assignee.trim();
  return { id, display_name: ASSIGNEE_NAMES[id] ?? id };
}

function installTasks(
  initial: IncidentTaskRecord[],
  options?: {
    permissions?: string[];
    roles?: string[];
    directoryStatus?: number;
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
      if (url.includes("/api/v1/directory/users")) {
        if (!sessionLive) {
          return jsonResponse(
            { code: "unauthenticated", message: "Authentication is required." },
            401,
          );
        }
        if (options?.directoryStatus) {
          return jsonResponse(
            { code: "forbidden", message: "traceback: secret assignee" },
            options.directoryStatus,
          );
        }
        const params = new URL(url, "http://localhost").searchParams;
        const q = (params.get("q") ?? "").toLowerCase();
        const visible = directoryUsers.filter((person) => {
          if (!q) return true;
          return (
            person.id.toLowerCase().includes(q) ||
            person.display_name.toLowerCase().includes(q) ||
            (person.department ?? "").toLowerCase().includes(q)
          );
        });
        const page = Number(params.get("page") ?? 1);
        const pageSize = Number(params.get("page_size") ?? 20);
        const start = (page - 1) * pageSize;
        return jsonResponse({
          page,
          page_size: pageSize,
          total: visible.length,
          items: visible.slice(start, start + pageSize).map((person) => ({
            ...person,
            email: "hidden@example.com",
            roles: ["SOC Analyst"],
            permissions: ["incident.manage"],
          })),
        });
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
              assignee: assigneeFromBody(body),
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
            assignee: "assignee" in body ? assigneeFromBody(body) : current.assignee,
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

  it("loads the operational directory without administration data or CSRF", async () => {
    const api = installTasks([seededTasks[0]!], {
      permissions: ["incident.read", "incident.manage", "directory.read"],
      roles: ["Auditor"],
    });
    const user = await openTasks();
    await user.click(screen.getByTestId("task-create"));
    const picker = await screen.findByTestId("task-assignee-picker");
    expect(within(picker).getByTestId("task-assignee-picker-current")).toHaveTextContent(
      "Current assignee: Unassigned",
    );
    expect(await within(picker).findByText("Jonah Hale")).toBeInTheDocument();
    expect(within(picker).getByText("USR-0004")).toBeInTheDocument();
    expect(within(picker).getByText("Security · SOC analyst")).toBeInTheDocument();
    expect(within(picker).queryByText("hidden@example.com")).not.toBeInTheDocument();
    expect(within(picker).queryByText("SOC Analyst")).not.toBeInTheDocument();
    expect(within(picker).queryByText(/incident\.manage/)).not.toBeInTheDocument();
    expect(picker.textContent ?? "").not.toMatch(UUID);
    const directoryIndex = api.calls.findIndex((url) => url.includes("/api/v1/directory/users"));
    expect(directoryIndex).toBeGreaterThanOrEqual(0);
    const directoryUrl = api.calls[directoryIndex] ?? "";
    expect(directoryUrl).toContain("page=1");
    expect(directoryUrl).toContain("page_size=20");
    expect(directoryUrl).not.toContain("page_size=100");
    expect(api.credentialFlags[directoryIndex]).toBe("include");
    expect((api.inits[directoryIndex]?.headers as Headers).get("X-CSRF-Token")).toBeNull();
    expect(api.inits[directoryIndex]?.method ?? "GET").toBe("GET");
    expect(api.calls.some((url) => url.includes("/api/v1/administration/users"))).toBe(false);
  });

  it("creates an unassigned task or a task assigned to a directory human id", async () => {
    setCsrfToken("task-csrf");
    const api = installTasks([seededTasks[0]!], {
      permissions: ["incident.read", "incident.manage", "directory.read"],
      roles: ["Read Only"],
    });
    const user = await openTasks();
    await user.click(screen.getByTestId("task-create"));
    await user.type(screen.getByTestId("task-title"), "Collect simulated host notes");
    await user.type(screen.getByTestId("task-assignee-picker-search"), "USR-0099");
    await user.click(screen.getByTestId("task-create-submit"));
    expect(await screen.findByTestId("task-success")).toHaveTextContent("Response task created.");
    const ignored = JSON.parse(
      String(api.inits.find((init) => init?.method === "POST")?.body),
    ) as Record<string, unknown>;
    expect(ignored).toEqual({ title: "Collect simulated host notes", status: "open" });
    expect(ignored).not.toHaveProperty("assignee");

    await user.click(screen.getByTestId("task-create"));
    await user.type(screen.getByTestId("task-title"), "Assign a directory user");
    await user.click(await screen.findByTestId("task-assignee-picker-option-USR-0004"));
    expect(screen.getByTestId("task-assignee-picker-current")).toHaveTextContent(
      "Current assignee: Jonah Hale · USR-0004",
    );
    await user.click(screen.getByTestId("task-create-submit"));
    expect(await screen.findByText("Assigned: Jonah Hale · USR-0004")).toBeInTheDocument();
    const post = api.inits.filter((init) => init?.method === "POST").at(-1);
    const body = JSON.parse(String(post?.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["assignee", "status", "title"]);
    expect(body).toEqual({
      title: "Assign a directory user",
      status: "open",
      assignee: "USR-0004",
    });
    expect(body).not.toHaveProperty("display_name");
    expect(body).not.toHaveProperty("department");
    expect(body).not.toHaveProperty("job_title");
    expect((post?.headers as Headers).get("X-CSRF-Token")).toBe("task-csrf");
    expect(api.calls.some((url) => url.includes("/api/v1/administration/users"))).toBe(false);
  });

  it("changes, clears, or leaves the assignee unchanged on patch", async () => {
    setCsrfToken("task-csrf");
    const api = installTasks([seededTasks[1]!], {
      permissions: ["incident.read", "incident.manage", "directory.read"],
      roles: ["SOC Analyst"],
    });
    const user = await openTasks();
    expect(screen.getByText("Assigned: Jonah Hale · USR-0004")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit TASK-0002" }));
    const picker = await screen.findByTestId("task-assignee-picker-TASK-0002");
    expect(within(picker).getByText("Current assignee: Jonah Hale · USR-0004")).toBeInTheDocument();
    await user.clear(screen.getByTestId("task-edit-title-TASK-0002"));
    await user.type(screen.getByTestId("task-edit-title-TASK-0002"), "Validate lab evidence");
    await user.click(screen.getByRole("button", { name: "Save task" }));
    expect(await screen.findByTestId("task-success")).toBeInTheDocument();
    const titlePatch = JSON.parse(
      String(api.inits.find((init) => init?.method === "PATCH")?.body),
    ) as Record<string, unknown>;
    expect(Object.keys(titlePatch).sort()).toEqual(["expected_updated_at", "title"]);
    expect(titlePatch.expected_updated_at).toBe(seededTasks[1]?.updated_at);
    expect(titlePatch).not.toHaveProperty("assignee");

    await user.click(screen.getByRole("button", { name: "Edit TASK-0002" }));
    await user.click(await screen.findByTestId("task-assignee-picker-TASK-0002-option-USR-0002"));
    await user.click(screen.getByRole("button", { name: "Save task" }));
    await screen.findByText("Assigned: Nia Okeke · USR-0002");
    const replacement = JSON.parse(
      String(api.inits.filter((init) => init?.method === "PATCH").at(-1)?.body),
    ) as Record<string, unknown>;
    expect(replacement).toEqual({
      assignee: "USR-0002",
      expected_updated_at: "2026-10-22T16:30:00+00:00",
    });
    expect(
      (api.inits.filter((init) => init?.method === "PATCH").at(-1)?.headers as Headers).get(
        "X-CSRF-Token",
      ),
    ).toBe("task-csrf");

    await user.click(screen.getByRole("button", { name: "Edit TASK-0002" }));
    await user.click(await screen.findByTestId("task-assignee-picker-TASK-0002-unassigned"));
    expect(screen.getByTestId("task-assignee-picker-TASK-0002-current")).toHaveTextContent(
      "Current assignee: Unassigned",
    );
    await user.click(screen.getByRole("button", { name: "Save task" }));
    await screen.findByText("Assigned: Unassigned");
    const cleared = JSON.parse(
      String(api.inits.filter((init) => init?.method === "PATCH").at(-1)?.body),
    ) as Record<string, unknown>;
    expect(cleared.assignee).toBeNull();
    expect(cleared.expected_updated_at).toBe("2026-10-22T16:30:00+00:00");
    expect(cleared.assignee).not.toBe("");
  });

  it("keeps task editing when directory.read is absent and hides editing without incident.manage", async () => {
    const managed = installTasks([seededTasks[1]!], {
      permissions: ["incident.read", "incident.manage"],
      roles: ["Administrator"],
    });
    let user = await openTasks();
    await user.click(screen.getByRole("button", { name: "Edit TASK-0002" }));
    expect(screen.getByTestId("task-edit-title-TASK-0002")).toBeInTheDocument();
    expect(screen.getByTestId("task-edit-status-TASK-0002")).toBeInTheDocument();
    expect(screen.getByTestId("task-assignee-readonly")).toHaveTextContent(
      "Assignee stays read-only.",
    );
    expect(screen.queryByTestId("task-assignee-picker-TASK-0002")).not.toBeInTheDocument();
    expect(screen.getByText("Assigned: Jonah Hale · USR-0004")).toBeInTheDocument();
    expect(managed.calls.some((url) => url.includes("/api/v1/directory/users"))).toBe(false);
    expect(managed.calls.some((url) => url.includes("/api/v1/administration/users"))).toBe(false);

    cleanup();
    installTasks([seededTasks[1]!], {
      permissions: ["incident.read"],
      roles: ["SOC Analyst"],
    });
    user = await openTasks();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("task-create")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Search active users")).not.toBeInTheDocument();
  });

  it("searches and pages the directory without dropping an assignee outside the page", async () => {
    const outside = task({
      id: "TASK-0008",
      title: "Keep the existing assignee",
      status: "open",
      assignee: { id: "USR-0099", display_name: "Casey Quinn" },
    });
    const api = installTasks([outside], {
      permissions: ["incident.read", "incident.manage", "directory.read"],
      roles: ["Security Engineer"],
    });
    const user = await openTasks();
    await user.click(screen.getByRole("button", { name: "Edit TASK-0008" }));
    const picker = await screen.findByTestId("task-assignee-picker-TASK-0008");
    expect(
      within(picker).getByText("Current assignee: Casey Quinn · USR-0099"),
    ).toBeInTheDocument();
    expect(await within(picker).findByText("Amara Okonkwo")).toBeInTheDocument();
    expect(within(picker).queryByText("USR-0022")).not.toBeInTheDocument();
    expect(within(picker).queryByText("USR-0099")).not.toBeInTheDocument();
    expect(
      within(picker).getByText("Current assignee: Casey Quinn · USR-0099"),
    ).toBeInTheDocument();
    await user.click(screen.getByTestId("task-assignee-picker-TASK-0008-pager-next"));
    expect(await within(picker).findByText("USR-0022")).toBeInTheDocument();
    expect(
      api.calls.some((url) => url.includes("/directory/users") && url.includes("page=2")),
    ).toBe(true);
    expect(
      api.calls
        .filter((url) => url.includes("/directory/users"))
        .every((url) => url.includes("page_size=20")),
    ).toBe(true);
    await user.click(screen.getByTestId("task-assignee-picker-TASK-0008-pager-previous"));
    await within(picker).findByText("Amara Okonkwo");
    await user.type(screen.getByTestId("task-assignee-picker-TASK-0008-search"), "nia");
    await waitFor(() => {
      const searched = api.calls.filter(
        (url) => url.includes("/directory/users") && url.includes("q=nia"),
      );
      expect(searched.length).toBeGreaterThan(0);
      expect(searched.every((url) => url.includes("page=1"))).toBe(true);
    });
    expect(await within(picker).findByText("Nia Okeke")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(picker).queryByText("Amara Okonkwo")).not.toBeInTheDocument();
    });
    await user.clear(screen.getByTestId("task-assignee-picker-TASK-0008-search"));
    await user.type(screen.getByTestId("task-assignee-picker-TASK-0008-search"), "zzzz-missing");
    expect(
      await within(picker).findByText("No active users match this search."),
    ).toBeInTheDocument();
    expect(
      within(picker).getByText("Current assignee: Casey Quinn · USR-0099"),
    ).toBeInTheDocument();
    expect(screen.getByText("Assigned: Casey Quinn · USR-0099")).toBeInTheDocument();
  });

  it("reports directory and assignee failures without traces or administration calls", async () => {
    setCsrfToken("task-csrf");
    const denied = installTasks([seededTasks[1]!], {
      permissions: ["incident.read", "incident.manage", "directory.read"],
      roles: ["GRC Analyst"],
      directoryStatus: 403,
    });
    let user = await openTasks();
    await user.click(screen.getByRole("button", { name: "Edit TASK-0002" }));
    expect(await screen.findByTestId("task-assignee-picker-TASK-0002-error")).toHaveTextContent(
      "You do not have access to the operational user directory.",
    );
    expect(screen.getByText("Current assignee: Jonah Hale · USR-0004")).toBeInTheDocument();
    expect(screen.queryByText(/traceback/i)).not.toBeInTheDocument();
    expect(denied.calls.some((url) => url.includes("/api/v1/administration/users"))).toBe(false);

    cleanup();
    installTasks([seededTasks[1]!], {
      permissions: ["incident.read", "incident.manage", "directory.read"],
      directoryStatus: 500,
    });
    user = await openTasks();
    await user.click(screen.getByRole("button", { name: "Edit TASK-0002" }));
    expect(await screen.findByTestId("task-assignee-picker-TASK-0002-error")).toHaveTextContent(
      "Unable to load assignees.",
    );
    expect(screen.getByText("Assigned: Jonah Hale · USR-0004")).toBeInTheDocument();

    cleanup();
    const api = installTasks([seededTasks[1]!], {
      permissions: ["incident.read", "incident.manage", "directory.read"],
      onPatch: () =>
        jsonResponse(
          {
            code: "validation_error",
            message: "Assignee must be an active user. traceback: secret",
          },
          422,
        ),
    });
    user = await openTasks();
    await user.click(screen.getByRole("button", { name: "Edit TASK-0002" }));
    await user.click(await screen.findByTestId("task-assignee-picker-TASK-0002-option-USR-0001"));
    const directoryCalls = api.calls.filter((url) =>
      url.includes("/api/v1/directory/users"),
    ).length;
    await user.click(screen.getByRole("button", { name: "Save task" }));
    expect(await screen.findByTestId("task-error")).toHaveTextContent(
      "The selected assignee is no longer eligible.",
    );
    expect(screen.queryByText(/traceback/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        api.calls.filter((url) => url.includes("/api/v1/directory/users")).length,
      ).toBeGreaterThan(directoryCalls);
    });

    api.expireSession();
    await user.type(screen.getByTestId("task-assignee-picker-TASK-0002-search"), "a");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});
