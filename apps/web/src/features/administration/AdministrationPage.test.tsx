import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import {
  administrationSummary,
  assetPage,
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
});
