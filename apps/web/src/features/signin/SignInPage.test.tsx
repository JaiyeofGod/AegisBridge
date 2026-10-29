import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppRouter } from "@/app/router";
import { MOTION_PREFERENCE_KEY, setMotionPreference } from "@/lib/motion-preference";
import motionCss from "@/styles/index.css?raw";
import { currentUserFixture, installApiFetch } from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

function stubMatchMedia({
  desktop,
  reducedMotion,
  finePointer = false,
}: {
  desktop: boolean;
  reducedMotion: boolean;
  finePointer?: boolean;
}) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion")
      ? reducedMotion
      : query.includes("min-width: 1024px")
        ? desktop
        : query.includes("pointer: fine")
          ? finePointer
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
    const copy = within(page)
      .getByRole("heading", { name: /see the threat/i })
      .closest(".motion-signin-enter");
    const panel = within(page)
      .getByRole("heading", { name: /^sign in$/i })
      .closest(".motion-signin-enter");
    const email = within(page).getByRole("textbox", { name: /work email/i });
    expect(copy).toBeTruthy();
    expect(copy).not.toHaveClass("motion-signin-enter-stagger");
    expect(panel).toHaveClass("motion-signin-enter-stagger");
    expect(email).toBeEnabled();
    expect(email).not.toHaveClass("motion-signin-enter");
    expect(email.closest(".motion-signin-enter")).toBe(panel);
    expect(
      within(page)
        .getByLabelText(/^Password$/i)
        .closest(".motion-signin-enter"),
    ).toBe(panel);
  });

  it("keeps the foreground entrance on one mount and disables it for reduced motion", () => {
    expect(motionCss).toMatch(
      /\.motion-signin-enter\s*\{[^}]*animation:\s*motion-signin-enter\s+var\(--motion-duration-cinematic\)\s+var\(--motion-ease-enter\)\s+both/,
    );
    expect(motionCss).toContain("animation-delay: calc(var(--motion-duration-fast) / 2)");
    expect(motionCss).toMatch(
      /@keyframes motion-signin-enter[\s\S]*?opacity:\s*0\.82;[\s\S]*?translate3d\(0,\s*var\(--motion-distance\)/,
    );

    const reduced = motionCss.slice(
      motionCss.indexOf("@media (prefers-reduced-motion: reduce)"),
      motionCss.indexOf("@layer utilities"),
    );
    expect(reduced).toContain(".motion-signin-enter");
    expect(reduced).toMatch(/\.motion-signin-enter[\s\S]*?animation:\s*none\s*!important/);
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
    expect(within(card).getByTestId("signin-artwork")).toHaveAttribute("data-parallax", "off");
    expect(within(page).queryByTestId("signin-spline-scene")).not.toBeInTheDocument();
    const copy = within(page)
      .getByRole("heading", { name: /see the threat/i })
      .closest(".motion-signin-enter");
    const panel = within(page)
      .getByRole("heading", { name: /^sign in$/i })
      .closest(".motion-signin-enter");
    expect(copy).toBeTruthy();
    expect(copy).not.toHaveClass("motion-signin-enter-stagger");
    expect(panel).toHaveClass("motion-signin-enter-stagger");
    expect(within(page).getByRole("textbox", { name: /work email/i })).toBeEnabled();
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

  it("uses the static sign-in fallback when the saved preference is reduce", async () => {
    installApiFetch(undefined, { authenticated: false });
    stubMatchMedia({ desktop: true, reducedMotion: false, finePointer: true });
    setMotionPreference("reduce");

    try {
      await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });
      const page = screen.getByTestId("signin-page");
      expect(page).toHaveAttribute("data-background", "static-canvas");
      expect(within(page).queryByTestId("signin-background-video")).not.toBeInTheDocument();
      expect(within(page).getByTestId("signin-visual")).toHaveAttribute(
        "data-visual-mode",
        "static-fallback",
      );
      expect(within(page).getByTestId("signin-artwork")).toHaveAttribute("data-parallax", "off");
      expect(within(page).getByRole("textbox", { name: /work email/i })).toBeEnabled();
    } finally {
      localStorage.removeItem(MOTION_PREFERENCE_KEY);
    }
  });

  it("keeps sign-in static when the operating system requests reduced motion", async () => {
    installApiFetch(undefined, { authenticated: false });
    stubMatchMedia({ desktop: true, reducedMotion: true, finePointer: true });
    setMotionPreference("system");

    try {
      await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });
      const page = screen.getByTestId("signin-page");
      expect(page).toHaveAttribute("data-background", "static-canvas");
      expect(within(page).queryByTestId("signin-background-video")).not.toBeInTheDocument();
      expect(within(page).getByTestId("signin-artwork")).toHaveAttribute("data-parallax", "off");
    } finally {
      localStorage.removeItem(MOTION_PREFERENCE_KEY);
    }
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
    expect(within(page).getByTestId("signin-artwork")).toHaveAttribute("data-parallax", "off");
  });

  it("enables artwork parallax only for a wide fine pointer without reduced motion", async () => {
    installApiFetch(undefined, { authenticated: false });
    stubMatchMedia({ desktop: true, reducedMotion: false, finePointer: true });

    await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });
    const page = screen.getByTestId("signin-page");
    const artwork = within(page).getByTestId("signin-artwork");
    const card = within(page).getByTestId("signin-visual-card");
    const form = within(page).getByRole("textbox", { name: /work email/i });

    expect(page).toHaveAttribute("data-background", "video");
    expect(within(page).getByTestId("signin-spline-scene")).toBeInTheDocument();
    expect(artwork).toHaveAttribute("data-parallax", "on");
    expect(artwork).toHaveClass("motion-artwork-parallax");
    expect(form.closest(".motion-artwork-parallax")).toBeNull();
    expect(
      within(page)
        .getByRole("heading", { name: /see the threat/i })
        .closest(".motion-artwork-parallax"),
    ).toBeNull();

    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    });
    card.dispatchEvent(new MouseEvent("pointermove", { clientX: 200, clientY: 50, bubbles: true }));
    expect(artwork.style.getPropertyValue("--artwork-x")).toBe("6.00px");
    expect(artwork.style.getPropertyValue("--artwork-ry")).toBe("1.00deg");
    expect(form.style.transform).toBe("");

    card.dispatchEvent(new MouseEvent("pointerleave"));
    expect(artwork.style.getPropertyValue("--artwork-x")).toBe("0px");
    expect(artwork.style.getPropertyValue("--artwork-y")).toBe("0px");
    expect(artwork.style.getPropertyValue("--artwork-rx")).toBe("0deg");
    expect(artwork.style.getPropertyValue("--artwork-ry")).toBe("0deg");
  });

  it("keeps artwork still for a coarse pointer on a wide screen", async () => {
    installApiFetch(undefined, { authenticated: false });
    stubMatchMedia({ desktop: true, reducedMotion: false, finePointer: false });

    await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });
    const page = screen.getByTestId("signin-page");
    const artwork = within(page).getByTestId("signin-artwork");
    expect(within(page).getByTestId("signin-spline-scene")).toBeInTheDocument();
    expect(artwork).toHaveAttribute("data-parallax", "off");
    expect(artwork).not.toHaveClass("motion-artwork-parallax");
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

    const email = within(page).getByRole("textbox", { name: /work email/i });
    await user.type(email, currentUserFixture.email);
    expect(
      within(page)
        .getByRole("heading", { name: /^sign in$/i })
        .closest(".motion-signin-enter"),
    ).toBe(panel);
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
    const panel = within(page)
      .getByRole("heading", { name: /^sign in$/i })
      .closest(".motion-signin-enter");
    await user.type(
      within(page).getByRole("textbox", { name: /work email/i }),
      currentUserFixture.email,
    );
    await user.type(within(page).getByLabelText(/^Password$/i), "local-dev-password");
    await user.click(within(page).getByRole("button", { name: /continue with email/i }));
    expect(await within(page).findByRole("button", { name: /signing in/i })).toBeDisabled();
    expect(
      within(page)
        .getByRole("heading", { name: /^sign in$/i })
        .closest(".motion-signin-enter"),
    ).toBe(panel);
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
