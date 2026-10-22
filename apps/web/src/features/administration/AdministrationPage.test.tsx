import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppRouter } from "@/app/router";
import { setCsrfToken } from "@/services/csrf";
import {
  accessReviewItems,
  administrationSummary,
  adminUsers,
  assetPage,
  authenticatedSessionFixture,
  currentUserFixture,
  emptyAdministrationSummary,
  installApiFetch,
  jsonResponse,
} from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

const secretPattern =
  /sk_live|AKIA[0-9A-Z]{8,}|api[_-]?key\s*[:=]\s*\S+|password\s*[:=]\s*\S+|BEGIN (RSA |OPENSSH )?PRIVATE KEY|eyJ[A-Za-z0-9_-]{10,}/i;

const roleNames = [
  "Administrator",
  "CISO",
  "GRC Analyst",
  "SOC Analyst",
  "Security Engineer",
  "Auditor",
  "Read Only",
];

describe("Administration", () => {
  it("renders seeded administration data without secrets or a live connector", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    const page = screen.getByTestId("administration-page");
    expect(
      within(page).getByRole("heading", { level: 1, name: "Administration" }),
    ).toBeInTheDocument();
    expect(await within(page).findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();
    expect(within(page).getAllByText(/Development seeded data/i).length).toBeGreaterThan(0);
    expect(within(page).getByText(/not live production/i)).toBeInTheDocument();
    expect(within(page).queryByText(/^SIMULATED$/)).not.toBeInTheDocument();
    expect(within(page).getByText(/no aggregate security score/i)).toBeInTheDocument();
    expect(within(page).getByText(/Pending access reviews: 1/)).toBeInTheDocument();
    expect(page.textContent ?? "").not.toMatch(secretPattern);
    expect(within(page).getAllByText("No credentials stored").length).toBeGreaterThan(0);
    expect(within(page).getByText("not_configured")).toBeInTheDocument();
    expect(within(page).getByText("reference_only")).toBeInTheDocument();
    expect(within(page).getAllByText("not_connected").length).toBeGreaterThan(0);
    expect(within(page).getByTestId("admin-integration-detail")).toHaveTextContent("INT-0001");
    expect(within(page).getByTestId("admin-integration-detail")).toHaveTextContent("Wazuh");
    expect(within(page).getByTestId("admin-integration-detail")).toHaveTextContent(
      "not_configured",
    );
    expect(within(page).getByTestId("admin-integration-detail")).toHaveTextContent("not_connected");
    expect(within(page).getByTestId("admin-integration-detail")).toHaveTextContent("Not recorded");
    expect(within(page).queryByText("AUD-014")).not.toBeInTheDocument();
    expect(within(page).queryByText("USR-001")).not.toBeInTheDocument();
  });

  it("shows the loading skeleton before the administration response arrives", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/administration")) return new Promise(() => undefined);
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.queryByText("INT-0001")).not.toBeInTheDocument();
    expect(screen.queryByText("AUD-014")).not.toBeInTheDocument();
    expect(screen.queryByText("USR-001")).not.toBeInTheDocument();
  });

  it("shows an error with retry and does not substitute fixture rows", async () => {
    let fail = true;
    installApiFetch((url) => {
      if (url.includes("/api/v1/administration/summary")) {
        return fail ? jsonResponse({ message: "down" }, 500) : jsonResponse(administrationSummary);
      }
      if (url.includes("/api/v1/administration")) return jsonResponse(assetPage([]));
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    expect(await screen.findByRole("alert")).toHaveTextContent("Administration data unavailable");
    expect(screen.queryByText("AUD-014")).not.toBeInTheDocument();
    expect(screen.queryByText("USR-001")).not.toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();
    expect(screen.getByText(/Pending access reviews: 1/)).toBeInTheDocument();
    expect(screen.queryByText("AUD-014")).not.toBeInTheDocument();
  });

  it("renders the seven-role catalog and privileged flags from the API", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    const page = screen.getByTestId("administration-page");
    expect(await within(page).findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Users" }));
    const users = within(page).getByTestId("admin-users");
    expect(users).toHaveTextContent("USR-0001");
    expect(users).toHaveTextContent("Amara Okonkwo");
    expect(users).toHaveTextContent("Privileged");
    expect(users).toHaveTextContent("USR-0002");
    expect(users).toHaveTextContent("Nia Okeke");
    expect(users).toHaveTextContent("Security Engineer");
    expect(users).toHaveTextContent("USR-0004");
    expect(users).toHaveTextContent("Not privileged");
    expect(users).not.toHaveTextContent("USR-001");

    await user.click(within(page).getByRole("tab", { name: "Roles & Permissions" }));
    const roles = within(page).getByTestId("admin-roles");
    for (const name of roleNames) {
      expect(roles).toHaveTextContent(name);
    }
    expect(roles).toHaveTextContent("detection.manage");
    expect(roles).toHaveTextContent("No permission labels are stored for this role.");
  });

  it("uses the privileged flag from the API instead of inferring it from the role name", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/administration/summary"))
        return jsonResponse(administrationSummary);
      if (url.includes("/api/v1/administration/users")) {
        return jsonResponse(
          assetPage([
            {
              id: "USR-0091",
              display_name: "Case Engineer",
              email: "case.engineer@aegisbridge.example",
              status: "active",
              department: "Security",
              roles: ["Security Engineer"],
              privileged: false,
            },
            {
              id: "USR-0092",
              display_name: "Case Auditor",
              email: "case.auditor@aegisbridge.example",
              status: "active",
              department: "GRC",
              roles: ["Auditor"],
              privileged: true,
            },
          ]),
        );
      }
      if (url.includes("/api/v1/administration")) return jsonResponse(assetPage([]));
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    const page = screen.getByTestId("administration-page");
    await user.click(await within(page).findByRole("tab", { name: "Users" }));
    const users = within(page).getByTestId("admin-users");
    const engineer = within(users).getByRole("row", { name: /USR-0091/ });
    const auditor = within(users).getByRole("row", { name: /USR-0092/ });
    expect(within(engineer).getByText("Not privileged")).toBeInTheDocument();
    expect(within(auditor).getByText("Privileged")).toBeInTheDocument();
  });

  it("renders audit events and access reviews from stored records", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    const page = screen.getByTestId("administration-page");
    expect(await within(page).findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Audit History" }));
    const audit = within(page).getByTestId("admin-audit");
    expect(audit).toHaveTextContent("AUD-0001");
    expect(audit).toHaveTextContent("AUD-0002");
    expect(audit).toHaveTextContent("Recorded Security Engineer catalog role");
    expect(audit).toHaveTextContent("USR-0001");
    expect(audit).not.toHaveTextContent("AUD-014");
    expect(audit.textContent ?? "").not.toMatch(secretPattern);

    await user.click(within(page).getByRole("tab", { name: "Access reviews" }));
    const reviews = within(page).getByTestId("admin-access-reviews");
    expect(reviews).toHaveTextContent("ARV-0001");
    expect(reviews).toHaveTextContent("October access review");
    expect(reviews).toHaveTextContent("Owner not stored");
    expect(reviews).toHaveTextContent("Due date not stored");
    expect(reviews).toHaveTextContent("Open findings 1 / 1");
  });

  it("shows empty states when users, roles, audit events, reviews, and sync history are absent", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/administration/summary")) {
        return jsonResponse(emptyAdministrationSummary);
      }
      if (url.includes("/api/v1/administration")) return jsonResponse(assetPage([]));
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    const page = screen.getByTestId("administration-page");
    expect(await within(page).findByText("No integrations are stored.")).toBeInTheDocument();
    expect(within(page).getByText("No integration status stored")).toBeInTheDocument();
    expect(within(page).queryByText("AUD-014")).not.toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Users" }));
    expect(within(page).getByTestId("admin-users")).toHaveTextContent("No users are stored.");

    await user.click(within(page).getByRole("tab", { name: "Roles & Permissions" }));
    expect(within(page).getByTestId("admin-roles")).toHaveTextContent("No roles are stored.");

    await user.click(within(page).getByRole("tab", { name: "Audit History" }));
    expect(within(page).getByTestId("admin-audit")).toHaveTextContent(
      "No audit events are stored.",
    );

    await user.click(within(page).getByRole("tab", { name: "Access reviews" }));
    expect(within(page).getByTestId("admin-access-reviews")).toHaveTextContent(
      "No access reviews are stored.",
    );
  });

  it("allows administration.manage users to update access reviews with CSRF", async () => {
    setCsrfToken("admin-csrf");
    const { calls, inits } = installApiFetch();
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    const page = screen.getByTestId("administration-page");
    await user.click(await within(page).findByRole("tab", { name: "Access reviews" }));
    expect(await within(page).findByTestId("access-review-editor")).toBeInTheDocument();

    await user.selectOptions(screen.getByTestId("access-review-status"), "completed");
    await user.click(screen.getByTestId("access-review-save"));

    expect(await screen.findByTestId("access-review-success")).toHaveTextContent(
      "Access review updated",
    );
    const patchIndex = calls.findIndex(
      (url, index) =>
        url.includes("/api/v1/administration/access-reviews/ARV-0001") &&
        inits[index]?.method === "PATCH",
    );
    expect(patchIndex).toBeGreaterThanOrEqual(0);
    const body = JSON.parse(String(inits[patchIndex]?.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["expected_updated_at", "status"].sort());
    expect(body.status).toBe("completed");
    expect(body.expected_updated_at).toBe(accessReviewItems[0]?.updated_at);
    expect(body).not.toHaveProperty("owner");
    expect(body).not.toHaveProperty("due_at");
    expect((inits[patchIndex]?.headers as Headers).get("X-CSRF-Token")).toBe("admin-csrf");
    expect(inits[patchIndex]?.credentials).toBe("include");
  });

  it("keeps access reviews read-only without administration.manage", async () => {
    const readOnlyUser = {
      ...currentUserFixture,
      permissions: ["administration.read", "audit.read"],
    };
    installApiFetch(
      (url) => {
        if (url.includes("/api/v1/auth/session")) {
          return jsonResponse({ ...authenticatedSessionFixture, user: readOnlyUser });
        }
        if (url.includes("/api/v1/auth/me")) {
          return jsonResponse(readOnlyUser);
        }
        return undefined;
      },
      { authenticated: true, allowAuthOverride: true },
    );
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    const page = screen.getByTestId("administration-page");
    await user.click(await within(page).findByRole("tab", { name: "Access reviews" }));
    expect(await within(page).findByTestId("access-review-editor-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("access-review-save")).not.toBeInTheDocument();
  });

  it("handles access-review 409 and 422 without claiming success", async () => {
    setCsrfToken("admin-csrf");
    installApiFetch((url, init) => {
      if (url.includes("/access-reviews/") && init?.method === "PATCH") {
        const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
        if (body.status === "cancelled") {
          return jsonResponse({ code: "validation_error", message: "Invalid status." }, 422);
        }
        return jsonResponse(
          { code: "conflict", message: "The access review was modified by another request." },
          409,
        );
      }
      return undefined;
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    const page = screen.getByTestId("administration-page");
    await user.click(await within(page).findByRole("tab", { name: "Access reviews" }));
    await screen.findByTestId("access-review-editor");

    await user.selectOptions(screen.getByTestId("access-review-status"), "closed");
    await user.click(screen.getByTestId("access-review-save"));
    expect(await screen.findByTestId("access-review-error")).toHaveTextContent(
      "modified by another request",
    );
    expect(screen.queryByTestId("access-review-success")).not.toBeInTheDocument();
    expect(screen.getByTestId("access-review-reload")).toBeInTheDocument();
  });

  it("updates user status with confirmation and refreshes summary", async () => {
    setCsrfToken("admin-csrf");
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { calls, inits } = installApiFetch();
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    const page = screen.getByTestId("administration-page");
    await user.click(await within(page).findByRole("tab", { name: "Users" }));
    await user.click(within(page).getByTestId("admin-user-select-USR-0004"));
    expect(await within(page).findByTestId("user-status-editor")).toBeInTheDocument();

    await user.selectOptions(screen.getByTestId("user-status-select"), "inactive");
    await user.click(screen.getByTestId("user-status-save"));

    expect(confirmSpy).toHaveBeenCalled();
    expect(await screen.findByTestId("user-status-success")).toHaveTextContent(
      "User status updated",
    );
    const patchIndex = calls.findIndex(
      (url, index) =>
        url.includes("/api/v1/administration/users/USR-0004") &&
        !url.includes("/roles") &&
        inits[index]?.method === "PATCH",
    );
    expect(patchIndex).toBeGreaterThanOrEqual(0);
    const body = JSON.parse(String(inits[patchIndex]?.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["expected_updated_at", "status"].sort());
    expect(body.status).toBe("inactive");
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("permissions");
    expect(body.expected_updated_at).toBe(
      adminUsers.find((item) => item.id === "USR-0004")?.updated_at,
    );
    confirmSpy.mockRestore();
  });

  it("shows last-admin protection on user status 409", async () => {
    setCsrfToken("admin-csrf");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    installApiFetch((url, init) => {
      if (url.includes("/users/USR-0001") && init?.method === "PATCH") {
        return jsonResponse(
          {
            code: "conflict",
            message: "Cannot disable the last active Administrator account.",
          },
          409,
        );
      }
      return undefined;
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    const page = screen.getByTestId("administration-page");
    await user.click(await within(page).findByRole("tab", { name: "Users" }));
    await user.click(within(page).getByTestId("admin-user-select-USR-0001"));
    await user.selectOptions(screen.getByTestId("user-status-select"), "inactive");
    await user.click(screen.getByTestId("user-status-save"));
    expect(await screen.findByTestId("user-status-error")).toHaveTextContent(
      "last active Administrator",
    );
    expect(screen.queryByTestId("user-status-success")).not.toBeInTheDocument();
  });

  it("keeps status and roles read-only without mutation permissions", async () => {
    const readOnlyUser = {
      ...currentUserFixture,
      permissions: ["administration.read"],
    };
    installApiFetch(
      (url) => {
        if (url.includes("/api/v1/auth/session")) {
          return jsonResponse({ ...authenticatedSessionFixture, user: readOnlyUser });
        }
        if (url.includes("/api/v1/auth/me")) {
          return jsonResponse(readOnlyUser);
        }
        return undefined;
      },
      { authenticated: true, allowAuthOverride: true },
    );
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    const page = screen.getByTestId("administration-page");
    await user.click(await within(page).findByRole("tab", { name: "Users" }));
    expect(await within(page).findByTestId("user-status-editor-readonly")).toBeInTheDocument();
    expect(within(page).getByTestId("user-roles-editor-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("user-status-save")).not.toBeInTheDocument();
    expect(screen.queryByTestId("user-roles-save")).not.toBeInTheDocument();
  });

  it("requires user.role.manage for role editing even with administration.manage", async () => {
    const manageOnly = {
      ...currentUserFixture,
      permissions: ["administration.read", "administration.manage"],
    };
    installApiFetch(
      (url) => {
        if (url.includes("/api/v1/auth/session")) {
          return jsonResponse({ ...authenticatedSessionFixture, user: manageOnly });
        }
        if (url.includes("/api/v1/auth/me")) {
          return jsonResponse(manageOnly);
        }
        return undefined;
      },
      { authenticated: true, allowAuthOverride: true },
    );
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    const page = screen.getByTestId("administration-page");
    await user.click(await within(page).findByRole("tab", { name: "Users" }));
    expect(await within(page).findByTestId("user-status-editor")).toBeInTheDocument();
    expect(within(page).getByTestId("user-roles-editor-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("user-roles-save")).not.toBeInTheDocument();
  });

  it("replaces user roles from the seven-role catalog with CSRF", async () => {
    setCsrfToken("admin-csrf");
    const { calls, inits } = installApiFetch();
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    const page = screen.getByTestId("administration-page");
    await user.click(await within(page).findByRole("tab", { name: "Users" }));
    await user.click(within(page).getByTestId("admin-user-select-USR-0004"));
    expect(await within(page).findByTestId("user-roles-editor")).toBeInTheDocument();

    await user.click(screen.getByTestId("user-role-soc-analyst"));
    await user.click(screen.getByTestId("user-role-auditor"));
    await user.click(screen.getByTestId("user-role-read-only"));
    await user.click(screen.getByTestId("user-roles-save"));

    expect(await screen.findByTestId("user-roles-success")).toHaveTextContent("User roles updated");
    const putIndex = calls.findIndex(
      (url, index) =>
        url.includes("/api/v1/administration/users/USR-0004/roles") &&
        inits[index]?.method === "PUT",
    );
    expect(putIndex).toBeGreaterThanOrEqual(0);
    const body = JSON.parse(String(inits[putIndex]?.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["expected_updated_at", "roles"].sort());
    expect(body.roles).toEqual(["Auditor", "Read Only"]);
    expect(body).not.toHaveProperty("permissions");
    expect(body).not.toHaveProperty("privileged");
    expect((inits[putIndex]?.headers as Headers).get("X-CSRF-Token")).toBe("admin-csrf");
  });

  it("surfaces last-admin role-removal conflict", async () => {
    setCsrfToken("admin-csrf");
    installApiFetch((url, init) => {
      if (url.includes("/users/USR-0001/roles") && init?.method === "PUT") {
        return jsonResponse(
          {
            code: "conflict",
            message: "Cannot remove Administrator from the last active Administrator account.",
          },
          409,
        );
      }
      return undefined;
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    const page = screen.getByTestId("administration-page");
    await user.click(await within(page).findByRole("tab", { name: "Users" }));
    await user.click(within(page).getByTestId("admin-user-select-USR-0001"));
    await user.click(screen.getByTestId("user-role-administrator"));
    await user.click(screen.getByTestId("user-role-read-only"));
    await user.click(screen.getByTestId("user-roles-save"));
    expect(await screen.findByTestId("user-roles-error")).toHaveTextContent(
      "last active Administrator",
    );
    expect(screen.queryByTestId("user-roles-success")).not.toBeInTheDocument();
  });
});
