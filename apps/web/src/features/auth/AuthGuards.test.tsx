import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { installApiFetch, jsonResponse } from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

describe("Auth session guards", () => {
  it("shows a loading state while auth status is unknown", async () => {
    installApiFetch(
      (url) => {
        if (url.includes("/api/v1/auth/session")) {
          return new Promise(() => undefined);
        }
        return undefined;
      },
      { authenticated: false, allowAuthOverride: true },
    );
    await renderWithProviders(<AppRouter />, {
      initialEntries: ["/overview"],
      waitForAuth: false,
    });
    const loading = await screen.findByTestId("auth-loading");
    expect(loading).toBeInTheDocument();
    expect(screen.getByTestId("prominent-loading")).toHaveTextContent("Checking session…");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(loading.querySelectorAll("div.h-12")).toHaveLength(0);
    expect(screen.queryByTestId("overview-page")).not.toBeInTheDocument();
  });

  it("keeps the sign-in session check on the stable skeleton", async () => {
    installApiFetch(
      (url) => {
        if (url.includes("/api/v1/auth/session")) {
          return new Promise(() => undefined);
        }
        return undefined;
      },
      { authenticated: false, allowAuthOverride: true },
    );
    await renderWithProviders(<AppRouter />, {
      initialEntries: ["/signin"],
      waitForAuth: false,
    });
    const loading = await screen.findByTestId("auth-loading");
    expect(loading).toHaveTextContent("Checking session…");
    expect(loading.querySelectorAll("div.h-12").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("prominent-loading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("signin-page")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users from protected routes to sign-in", async () => {
    installApiFetch(undefined, { authenticated: false });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/overview"] });
    expect(await screen.findByTestId("signin-page")).toBeInTheDocument();
    expect(screen.queryByTestId("overview-page")).not.toBeInTheDocument();
  });

  it("renders protected routes when authenticated", async () => {
    installApiFetch(undefined, { authenticated: true });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/overview"] });
    expect(await screen.findByTestId("overview-page")).toBeInTheDocument();
  });

  it("restores an authenticated session after app load", async () => {
    installApiFetch(undefined, { authenticated: true });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/account/profile"] });
    expect(await screen.findByTestId("account-profile")).toHaveTextContent("USR-0001");
    expect(screen.getByTestId("account-profile")).toHaveTextContent("Amara Okonkwo");
  });

  it("signs out, clears auth caches, and redirects to sign-in", async () => {
    const { calls } = installApiFetch(undefined, { authenticated: true });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/account/profile"] });
    expect(await screen.findByTestId("account-page")).toBeInTheDocument();
    await user.click(screen.getAllByTestId("sign-out-button")[0]);
    expect(await screen.findByTestId("signin-page")).toBeInTheDocument();
    expect(calls.some((url) => url.includes("/api/v1/auth/logout"))).toBe(true);
    expect(window.localStorage.length).toBe(0);
  });

  it("handles failed logout honestly", async () => {
    installApiFetch(
      (url, init) => {
        if (url.includes("/api/v1/auth/logout") && init?.method === "POST") {
          return jsonResponse({ code: "http_error", message: "logout failed" }, 500);
        }
        return undefined;
      },
      { authenticated: true, allowAuthOverride: true },
    );
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/account/profile"] });
    expect(await screen.findByTestId("account-page")).toBeInTheDocument();
    await user.click(screen.getAllByTestId("sign-out-button")[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be completed/i);
    expect(screen.getByTestId("account-page")).toBeInTheDocument();
  });
});
