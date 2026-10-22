import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { currentUserFixture, installApiFetch } from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

describe("Sign-in page", () => {
  it("renders welcome copy and form controls when unauthenticated", async () => {
    installApiFetch(undefined, { authenticated: false });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });

    const page = screen.getByTestId("signin-page");
    expect(page).toBeInTheDocument();
    expect(within(page).getByText(/See the threat/i)).toBeInTheDocument();
    expect(within(page).getByText(/Bridge the response/i)).toBeInTheDocument();
    expect(within(page).getByText("YOUR SECURITY WORKSPACE")).toBeInTheDocument();
    expect(within(page).getByRole("textbox", { name: /work email/i })).toBeInTheDocument();
    expect(within(page).getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(within(page).getByRole("button", { name: /organization sso/i })).toBeDisabled();
    expect(within(page).getByTestId("dev-email-hint")).toHaveTextContent(
      "amara.okonkwo@aegisbridge.example",
    );
    expect(page.textContent ?? "").not.toMatch(/AEGIS_DEV_ADMIN_PASSWORD|Dev-Only/i);
  });

  it("uses static scene fallback when reduced motion is preferred", async () => {
    installApiFetch(undefined, { authenticated: false });
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;

    await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });
    const visual = screen.getByTestId("signin-visual");
    expect(visual).toHaveAttribute("data-visual-mode", "static-fallback");
    const card = within(visual).getByTestId("signin-visual-card");
    expect(card).toBeInTheDocument();
    expect(within(card).getByTestId("signin-scene-fallback")).toBeInTheDocument();
  });

  it("signs in with credentials include and navigates to overview", async () => {
    const { credentialFlags, calls } = installApiFetch(undefined, { authenticated: false });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });
    const page = screen.getByTestId("signin-page");

    await user.type(
      within(page).getByRole("textbox", { name: /work email/i }),
      currentUserFixture.email,
    );
    await user.type(within(page).getByLabelText(/^Password$/i), "local-dev-password");
    await user.click(within(page).getByRole("button", { name: /continue with email/i }));

    expect(await screen.findByTestId("overview-page")).toBeInTheDocument();
    expect(calls.some((url) => url.includes("/api/v1/auth/login"))).toBe(true);
    expect(credentialFlags.every((value) => value === "include")).toBe(true);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("shows a generic invalid-credentials error and clears the password", async () => {
    installApiFetch(undefined, { authenticated: false });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });
    const page = screen.getByTestId("signin-page");

    await user.type(
      within(page).getByRole("textbox", { name: /work email/i }),
      currentUserFixture.email,
    );
    const password = within(page).getByLabelText(/^Password$/i);
    await user.type(password, "wrong-password");
    await user.click(within(page).getByRole("button", { name: /continue with email/i }));

    expect(await within(page).findByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(password).toHaveValue("");
    expect(within(page).queryByText(/does not exist|inactive|USR-0001/i)).not.toBeInTheDocument();
  });

  it("disables submit while sign-in is in progress", async () => {
    installApiFetch(
      (url) => {
        if (url.includes("/api/v1/auth/login")) {
          return new Promise(() => undefined);
        }
        return undefined;
      },
      { authenticated: false, allowAuthOverride: true },
    );
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });
    const page = screen.getByTestId("signin-page");
    await user.type(
      within(page).getByRole("textbox", { name: /work email/i }),
      currentUserFixture.email,
    );
    await user.type(within(page).getByLabelText(/^Password$/i), "local-dev-password");
    await user.click(within(page).getByRole("button", { name: /continue with email/i }));
    expect(await within(page).findByRole("button", { name: /signing in/i })).toBeDisabled();
  });

  it("redirects authenticated users away from sign-in", async () => {
    installApiFetch(undefined, { authenticated: true });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });
    expect(await screen.findByTestId("overview-page")).toBeInTheDocument();
  });

  it("keeps interactive targets keyboard reachable", async () => {
    installApiFetch(undefined, { authenticated: false });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });
    const page = screen.getByTestId("signin-page");
    const email = within(page).getByRole("textbox", { name: /work email/i });
    email.focus();
    expect(email).toHaveFocus();
  });
});
