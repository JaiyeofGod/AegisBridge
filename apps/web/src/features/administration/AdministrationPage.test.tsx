import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { renderWithProviders } from "@/test/render";

const secretPattern =
  /sk_live|AKIA[0-9A-Z]{8,}|api[_-]?key\s*[:=]\s*\S+|password\s*[:=]\s*\S+|BEGIN (RSA |OPENSSH )?PRIVATE KEY|eyJ[A-Za-z0-9_-]{10,}/i;

describe("Administration", () => {
  it("renders /administration with simulated labeling and no score or secrets", () => {
    renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    const page = screen.getByTestId("administration-page");
    expect(
      within(page).getByRole("heading", { level: 1, name: "Administration" }),
    ).toBeInTheDocument();
    expect(within(page).getAllByText(/simulated/i).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/no aggregate security score/i).length).toBeGreaterThan(0);
    expect(within(page).queryByText(/overall security score/i)).not.toBeInTheDocument();
    expect(page.textContent ?? "").not.toMatch(secretPattern);
    expect(within(page).getAllByText(/stored secrets are not shown/i).length).toBeGreaterThan(0);
    expect(within(page).getByRole("tab", { name: "Integrations" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("renders integration status, roles, audit history, and workspace", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRouter />, { initialEntries: ["/administration"] });
    const page = screen.getByTestId("administration-page");
    expect(within(page).getAllByText("Not configured").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("Simulated").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("Delayed").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("Planned").length).toBeGreaterThan(0);
    expect(within(page).getByTestId("admin-integration-detail")).toHaveTextContent("Wazuh");
    expect(within(page).getByTestId("admin-integration-detail")).toHaveTextContent("Not connected");

    await user.click(within(page).getByRole("tab", { name: "Users" }));
    expect(within(page).getByTestId("admin-users")).toHaveTextContent("USR-001");
    expect(within(page).getByTestId("admin-users")).toHaveTextContent("Review due");

    await user.click(within(page).getByRole("tab", { name: "Roles & Permissions" }));
    const roles = within(page).getByTestId("admin-roles");
    for (const name of [
      "Administrator",
      "CISO",
      "GRC Analyst",
      "SOC Analyst",
      "Auditor",
      "Read Only",
    ]) {
      expect(roles).toHaveTextContent(name);
    }

    await user.click(within(page).getByRole("tab", { name: "Audit History" }));
    expect(within(page).getByTestId("admin-audit")).toHaveTextContent("AUD-014");
    expect(within(page).getByTestId("admin-audit")).toHaveTextContent("USR-001");

    await user.click(within(page).getByRole("tab", { name: "Workspace" }));
    const workspace = within(page).getByTestId("admin-workspace");
    expect(workspace).toHaveTextContent("AegisBridge Technologies");
    expect(workspace).toHaveTextContent("Not connected");
    expect(workspace.textContent ?? "").not.toMatch(secretPattern);
  });
});
