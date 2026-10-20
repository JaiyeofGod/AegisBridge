import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { renderWithProviders } from "@/test/render";

const secretPattern =
  /sk_live|AKIA[0-9A-Z]{8,}|api[_-]?key\s*[:=]\s*\S+|password\s*[:=]\s*\S+|BEGIN (RSA |OPENSSH )?PRIVATE KEY|eyJ[A-Za-z0-9_-]{10,}|recovery code\s*[:=]/i;

const routes = [
  ["/account/profile", "My profile"],
  ["/account/security", "Account security"],
  ["/account/preferences", "Preferences"],
  ["/account/workspace", "Workspace"],
] as const;

describe("Account", () => {
  it.each(routes)("renders %s", async (path, title) => {
    await renderWithProviders(<AppRouter />, { initialEntries: [path] });
    const page = screen.getByTestId("account-page");
    expect(within(page).getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(within(page).getByRole("navigation", { name: "Account sections" })).toBeInTheDocument();
    expect(within(page).getAllByText(/simulated/i).length).toBeGreaterThan(0);
    expect(page.textContent ?? "").not.toMatch(secretPattern);
  });

  it("moves between account sections from the local navigation", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/account/profile"] });
    const page = screen.getByTestId("account-page");
    const nav = within(page).getByRole("navigation", { name: "Account sections" });

    expect(within(nav).getByRole("link", { name: "My profile" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await user.click(within(nav).getByRole("link", { name: "Account security" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Account security" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Preferences" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Preferences" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Workspace" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Workspace" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "My profile" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "My profile" }),
    ).toBeInTheDocument();
  });

  it("renders profile fields for the simulated current user", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/account/profile"] });
    const profile = screen.getByTestId("account-profile");
    expect(profile).toHaveTextContent("Amara Okonkwo");
    expect(profile).toHaveTextContent("amara.okonkwo@aegisbridge.example");
    expect(profile).toHaveTextContent("Security administrator");
    expect(profile).toHaveTextContent("Security");
    expect(profile).toHaveTextContent("Administrator");
    expect(profile).toHaveTextContent("Active · Simulated");
    expect(profile).toHaveTextContent("America/New_York");
    expect(profile).toHaveTextContent("USR-001");
    expect(screen.getByLabelText("Time zone")).toBeDisabled();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });

  it("renders security status, MFA, and sessions without mutation controls", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/account/security"] });
    const security = screen.getByTestId("account-security");
    expect(security).toHaveTextContent("Organization sign-in");
    expect(security).toHaveTextContent("No password is stored on this screen");
    expect(security).toHaveTextContent("Enrolled · Simulated");
    expect(security).toHaveTextContent("Recovery codes are not shown");
    expect(security).toHaveTextContent("Current session");
    expect(security).toHaveTextContent("19 Oct 2026, 21:05 ET · Simulated");
    expect(security).toHaveTextContent("Idle timeout label is 8 hours");
    expect(security).toHaveTextContent("Failed · Simulated");

    const page = screen.getByTestId("account-page");
    expect(within(page).getByRole("button", { name: /save changes/i })).toBeDisabled();
    for (const name of [/change password/i, /enable mfa/i, /revoke session/i]) {
      const control = within(security).getAllByRole("button", { name })[0];
      expect(control).toBeDisabled();
    }

    expect(security.textContent ?? "").not.toMatch(/password updated|mfa enabled|session revoked/i);
    expect(security).toHaveTextContent("does not change a password");
    expect(security).toHaveTextContent("does not enroll or change MFA");
    expect(security).toHaveTextContent("does not revoke a session");
    expect(security.textContent ?? "").not.toMatch(secretPattern);
  });

  it("renders preference controls as a local preview", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/account/preferences"] });
    const preferences = screen.getByTestId("account-preferences");

    expect(within(preferences).getByRole("radio", { name: "Dark selected" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      within(preferences).getByRole("radio", { name: "Comfortable selected" }),
    ).toBeInTheDocument();
    expect(preferences).toHaveTextContent("Follow device setting");
    expect(preferences).toHaveTextContent("Local time with explicit zone");
    expect(screen.getByLabelText("Default landing page")).toHaveValue("Overview");
    expect(preferences).toHaveTextContent("Assigned tasks");
    expect(preferences).toHaveTextContent("Incident mentions");
    expect(preferences).toHaveTextContent("Evidence due dates");
    expect(preferences).toHaveTextContent("not saved");
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();

    await user.click(within(preferences).getByRole("radio", { name: "Light" }));
    expect(within(preferences).getByRole("radio", { name: "Light selected" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(preferences).toHaveTextContent("not saved");

    const email = within(preferences).getAllByRole("button", {
      name: /email delivery is not connected/i,
    })[0];
    expect(email).toBeDisabled();
  });

  it("renders the current user's workspace without administration controls", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/account/workspace"] });
    const workspace = screen.getByTestId("account-workspace");
    expect(workspace).toHaveTextContent("AegisBridge Technologies");
    expect(workspace).toHaveTextContent("AegisBridge Labs");
    expect(workspace).toHaveTextContent("Simulated enterprise");
    expect(workspace).toHaveTextContent("Administrator");
    expect(workspace).toHaveTextContent("LAB · Simulated data");
    expect(workspace).toHaveTextContent("Membership active");
    expect(workspace).toHaveTextContent("integration.manage");
    expect(workspace).toHaveTextContent("user.role.manage");
    expect(workspace).toHaveTextContent("not enforced");
    expect(workspace).toHaveTextContent("Cloudflare R2 is planned");
    expect(workspace).toHaveTextContent("Not connected");
    expect(within(workspace).getByRole("button", { name: /switch organization/i })).toBeDisabled();
    expect(within(workspace).getByRole("link", { name: /manage users, roles/i })).toHaveAttribute(
      "href",
      "/administration",
    );
    expect(workspace.textContent ?? "").not.toMatch(secretPattern);
  });
});
