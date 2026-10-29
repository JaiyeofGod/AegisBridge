import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { currentUserFixture, installApiFetch } from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

function stubMatchMedia({ desktop, reducedMotion }: { desktop: boolean; reducedMotion: boolean }) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion")
      ? reducedMotion
      : query.includes("min-width: 1024px")
        ? desktop
        : false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

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
    expect(
      within(page)
        .getByRole("heading", { name: /see the threat/i })
        .closest(".motion-signin-enter"),
    ).toBeTruthy();
    const panel = within(page)
      .getByRole("heading", { name: /^sign in$/i })
      .closest(".motion-signin-enter");
    expect(panel).toBeTruthy();
    expect(within(page).getByRole("textbox", { name: /work email/i })).toBeEnabled();
  });

  it("uses static scene fallback when reduced motion is preferred", async () => {
    installApiFetch(undefined, { authenticated: false });
    stubMatchMedia({ desktop: true, reducedMotion: true });

    await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });
    const page = screen.getByTestId("signin-page");
    expect(page).toHaveAttribute("data-background", "static-canvas");
    expect(within(page).getByTestId("signin-static-background")).toBeInTheDocument();
    expect(within(page).getByTestId("signin-readability-overlay")).toBeInTheDocument();
    expect(within(page).queryByTestId("signin-background-video")).not.toBeInTheDocument();
    const visual = within(page).getByTestId("signin-visual");
    expect(visual).toHaveAttribute("data-visual-mode", "static-fallback");
    const card = within(visual).getByTestId("signin-visual-card");
    expect(card).toBeInTheDocument();
    expect(within(card).getByTestId("signin-scene-fallback")).toBeInTheDocument();
    expect(within(page).queryByTestId("signin-spline-scene")).not.toBeInTheDocument();
    expect(
      within(page)
        .getByRole("heading", { name: /see the threat/i })
        .closest(".motion-signin-enter"),
    ).toBeTruthy();
    expect(
      within(page)
        .getByRole("heading", { name: /^sign in$/i })
        .closest(".motion-signin-enter"),
    ).toBeTruthy();
  });

  it("plays the looping background video on desktop when motion is allowed", async () => {
    installApiFetch(undefined, { authenticated: false });
    stubMatchMedia({ desktop: true, reducedMotion: false });

    await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });
    const page = screen.getByTestId("signin-page");
    expect(page).toHaveAttribute("data-background", "video");
    const video = within(page).getByTestId("signin-background-video");
    expect(video).toHaveAttribute(
      "src",
      expect.stringContaining("/media/aegisbridge-network-loop.mp4"),
    );
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveProperty("muted", true);
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("playsinline");
    expect(within(page).getByTestId("signin-readability-overlay")).toBeInTheDocument();
    expect(within(page).queryByTestId("signin-static-background")).not.toBeInTheDocument();
    const scene = within(page).getByTestId("signin-spline-scene");
    expect(scene.querySelector(".duration-500")).toBeTruthy();
    expect(scene.querySelector(".duration-700")).toBeTruthy();
    expect(within(page).getByRole("textbox", { name: /work email/i })).toBeEnabled();
  });

  it("uses the static canvas instead of video below 1024px", async () => {
    installApiFetch(undefined, { authenticated: false });
    stubMatchMedia({ desktop: false, reducedMotion: false });

    await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });
    const page = screen.getByTestId("signin-page");
    expect(page).toHaveAttribute("data-background", "static-canvas");
    expect(within(page).getByTestId("signin-static-background")).toBeInTheDocument();
    expect(within(page).queryByTestId("signin-background-video")).not.toBeInTheDocument();
    expect(within(page).getByTestId("signin-visual")).toHaveAttribute(
      "data-visual-mode",
      "static-fallback",
    );
    expect(within(page).queryByTestId("signin-spline-scene")).not.toBeInTheDocument();
    expect(within(page).getByTestId("signin-scene-fallback")).toBeInTheDocument();
  });

  it("no longer serves the cinematic login prototype route", async () => {
    installApiFetch(undefined, { authenticated: false });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/prototype/cinematic-login"] });
    expect(await screen.findByTestId("signin-page")).toBeInTheDocument();
    expect(screen.queryByTestId("cinematic-login-prototype")).not.toBeInTheDocument();
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
    const panel = within(page)
      .getByRole("heading", { name: /^sign in$/i })
      .closest(".motion-signin-enter");

    await user.type(
      within(page).getByRole("textbox", { name: /work email/i }),
      currentUserFixture.email,
    );
    const password = within(page).getByLabelText(/^Password$/i);
    await user.type(password, "wrong-password");
    await user.click(within(page).getByRole("button", { name: /continue with email/i }));

    expect(await within(page).findByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(
      within(page)
        .getByRole("heading", { name: /^sign in$/i })
        .closest(".motion-signin-enter"),
    ).toBe(panel);
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
    expect(email.closest(".motion-signin-enter")).toBe(
      within(page)
        .getByRole("heading", { name: /^sign in$/i })
        .closest(".motion-signin-enter"),
    );
  });
});
