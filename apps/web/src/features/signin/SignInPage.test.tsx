import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { renderWithProviders } from "@/test/render";

describe("Sign-in page", () => {
  it("renders welcome copy and form controls", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });

    const page = screen.getByTestId("signin-page");
    expect(page).toBeInTheDocument();
    expect(within(page).getByText(/See the threat/i)).toBeInTheDocument();
    expect(within(page).getByText(/Bridge the response/i)).toBeInTheDocument();
    expect(within(page).getByText("YOUR SECURITY WORKSPACE")).toBeInTheDocument();
    expect(within(page).getByRole("textbox", { name: /work email/i })).toBeInTheDocument();
    expect(within(page).getByRole("button", { name: /organization sso/i })).toBeDisabled();
    expect(within(page).getByText(/authentication is not connected/i)).toBeInTheDocument();
  });

  it("uses static scene fallback when reduced motion is preferred", async () => {
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
    expect(within(visual).getByTestId("signin-scene-fallback")).toBeInTheDocument();
  });

  it("explore demo navigates to overview as simulated entry", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });

    const page = screen.getByTestId("signin-page");
    await user.click(within(page).getByTestId("explore-demo"));
    const overview = await screen.findByTestId("overview-page");
    expect(overview).toBeInTheDocument();
    expect(within(overview).getByTestId("simulated-data-banner")).toBeInTheDocument();
  });

  it("keeps interactive targets keyboard reachable", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/signin"] });
    const page = screen.getByTestId("signin-page");
    const email = within(page).getByRole("textbox", { name: /work email/i });
    email.focus();
    expect(email).toHaveFocus();
  });
});
