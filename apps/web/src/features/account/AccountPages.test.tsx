import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { MOTION_PREFERENCE_KEY } from "@/lib/motion-preference";
import { installApiFetch } from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

const secretPattern =
  /sk_live|AKIA[0-9A-Z]{8,}|api[_-]?key\s*[:=]\s*\S+|password_hash|token_digest|aegis_session=|BEGIN (RSA |OPENSSH )?PRIVATE KEY|eyJ[A-Za-z0-9_-]{10,}/i;

const routes = [
  ["/account/profile", "My profile"],
  ["/account/security", "Account security"],
  ["/account/preferences", "Preferences"],
  ["/account/workspace", "Workspace"],
] as const;

describe("Account", () => {
  it.each(routes)("renders %s from the API", async (path, title) => {
    installApiFetch(undefined, { authenticated: true });
    await renderWithProviders(<AppRouter />, { initialEntries: [path] });
    const page = screen.getByTestId("account-page");
    expect(within(page).getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(within(page).getByRole("navigation", { name: "Account sections" })).toBeInTheDocument();
    expect(page.textContent ?? "").not.toMatch(secretPattern);
    expect(within(page).queryByText("USR-001")).not.toBeInTheDocument();
  });

  it("moves between account sections from the local navigation", async () => {
    installApiFetch(undefined, { authenticated: true });
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
  });

  it("renders profile fields from the account API", async () => {
    installApiFetch(undefined, { authenticated: true });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/account/profile"] });
    const profile = await screen.findByTestId("account-profile");
    expect(profile).toHaveTextContent("Amara Okonkwo");
    expect(profile).toHaveTextContent("amara.okonkwo@aegisbridge.example");
    expect(profile).toHaveTextContent("Security administrator");
    expect(profile).toHaveTextContent("Security");
    expect(profile).toHaveTextContent("Administrator");
    expect(profile).toHaveTextContent("active");
    expect(profile).toHaveTextContent("America/New_York");
    expect(profile).toHaveTextContent("USR-0001");
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });

  it("renders security metadata without secrets or MFA enrollment", async () => {
    installApiFetch(undefined, { authenticated: true });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/account/security"] });
    const security = await screen.findByTestId("account-security");
    expect(security).toHaveTextContent("Local password authentication is configured");
    expect(security).toHaveTextContent("Not configured in this phase");
    expect(security).toHaveTextContent("SES-TEST0001");
    expect(security).toHaveTextContent("Created");
    expect(security).toHaveTextContent("Last seen");
    expect(security).toHaveTextContent("Expires");
    expect(within(security).getByTestId("logout-all-button")).toBeEnabled();
    expect(security.textContent ?? "").not.toMatch(secretPattern);
    expect(security).not.toHaveTextContent("password_hash");
    expect(security).not.toHaveTextContent("token_digest");
  });

  it("renders preferences as Default and persists changed fields", async () => {
    const { inits, calls } = installApiFetch(undefined, { authenticated: true });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/account/preferences"] });
    const preferences = await screen.findByTestId("account-preferences");
    expect(preferences).toHaveTextContent("Default");
    expect(preferences).not.toHaveTextContent("not_stored");
    expect(screen.getByTestId("preferences-save")).toBeEnabled();

    await user.click(within(preferences).getByRole("radio", { name: "dark" }));
    await user.click(screen.getByTestId("preferences-save"));

    const saved = await screen.findByTestId("preferences-success");
    expect(saved).toHaveTextContent("Preferences saved");
    expect(saved).toHaveAttribute("role", "status");
    expect(saved).toHaveClass("motion-status-enter");
    expect(await screen.findByTestId("preferences-persistence")).toHaveTextContent("Stored");

    const patchIndex = calls.findIndex(
      (url, index) =>
        url.includes("/api/v1/account/preferences") && inits[index]?.method === "PATCH",
    );
    expect(patchIndex).toBeGreaterThanOrEqual(0);
    const patchInit = inits[patchIndex];
    expect(patchInit?.credentials).toBe("include");
    expect((patchInit?.headers as Headers).get("X-CSRF-Token")).toBeTruthy();
    expect(JSON.parse(String(patchInit?.body))).toEqual({ theme: "dark" });
    expect(JSON.stringify(patchInit?.body)).not.toContain("landing_page");
  });

  it("shows validation errors from preference PATCH", async () => {
    installApiFetch(
      (url, init) => {
        if (url.includes("/api/v1/account/preferences") && init?.method === "PATCH") {
          return {
            ok: false,
            status: 422,
            json: async () => ({
              code: "validation_error",
              message: "theme must be one of: system, dark, light",
            }),
            text: async () =>
              JSON.stringify({
                code: "validation_error",
                message: "theme must be one of: system, dark, light",
              }),
            headers: { get: () => "application/json" },
          };
        }
        return undefined;
      },
      { authenticated: true, allowAuthOverride: true },
    );
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/account/preferences"] });
    await screen.findByTestId("account-preferences");
    await user.click(screen.getByRole("radio", { name: "dark" }));
    await user.click(screen.getByTestId("preferences-save"));
    expect(await screen.findByTestId("preferences-error")).toHaveTextContent(
      /theme must be one of/i,
    );
  });

  it("stores the motion preference in this browser and keeps it keyboard accessible", async () => {
    localStorage.removeItem(MOTION_PREFERENCE_KEY);
    const { inits, calls } = installApiFetch(undefined, { authenticated: true });
    const user = userEvent.setup();
    const view = await renderWithProviders(<AppRouter />, {
      initialEntries: ["/account/preferences"],
    });
    const preferences = await screen.findByTestId("account-preferences");
    const follow = within(preferences).getByRole("radio", { name: "Follow system setting" });
    const reduce = within(preferences).getByRole("radio", { name: "Reduce motion" });

    expect(preferences).toHaveTextContent(
      "Reduced motion removes nonessential animation and cinematic effects.",
    );
    expect(follow).toBeChecked();
    expect(reduce).not.toBeChecked();
    follow.focus();
    expect(follow).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(reduce).toBeChecked();
    expect(localStorage.getItem(MOTION_PREFERENCE_KEY)).toBe("reduce");
    expect(document.documentElement.dataset.motion).toBe("reduce");

    view.unmount();
    const reloaded = await renderWithProviders(<AppRouter />, {
      initialEntries: ["/account/preferences"],
    });
    expect(await screen.findByRole("radio", { name: "Reduce motion" })).toBeChecked();

    localStorage.setItem(MOTION_PREFERENCE_KEY, "always");
    reloaded.unmount();
    const restored = await renderWithProviders(<AppRouter />, {
      initialEntries: ["/account/preferences"],
    });
    expect(await screen.findByRole("radio", { name: "Follow system setting" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "dark" }));
    await user.click(screen.getByTestId("preferences-save"));
    await screen.findByTestId("preferences-success");
    const patchIndex = calls.findIndex(
      (url, index) =>
        url.includes("/api/v1/account/preferences") && inits[index]?.method === "PATCH",
    );
    expect(JSON.parse(String(inits[patchIndex]?.body))).toEqual({ theme: "dark" });
    restored.unmount();
    localStorage.removeItem(MOTION_PREFERENCE_KEY);
  });

  it("renders workspace roles and privileged flag from the API", async () => {
    installApiFetch(undefined, { authenticated: true });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/account/workspace"] });
    const workspace = await screen.findByTestId("account-workspace");
    expect(workspace).toHaveTextContent("AegisBridge Technologies");
    expect(workspace).toHaveTextContent("Administrator");
    expect(workspace).toHaveTextContent("Privileged");
    expect(workspace).toHaveTextContent("administration.read");
    expect(workspace).toHaveTextContent("Security Engineer");
    expect(within(workspace).getByRole("link", { name: /manage users, roles/i })).toHaveAttribute(
      "href",
      "/administration",
    );
    expect(workspace.textContent ?? "").not.toMatch(secretPattern);
  });
});
