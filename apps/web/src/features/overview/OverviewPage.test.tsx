import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { renderWithProviders } from "@/test/render";
import { installApiFetch, jsonResponse, overviewFixture } from "@/test/api-fixtures";

describe("Overview page", () => {
  beforeEach(() => {
    installApiFetch();
  });

  it("renders overview success from the API with seeded labeling", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/overview"] });

    const page = screen.getByTestId("overview-page");
    expect(within(page).getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(await within(page).findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();
    expect(within(page).getByText(/Development seeded data/i)).toBeInTheDocument();
    expect(within(page).getByText(/not live production/i)).toBeInTheDocument();

    expect(within(page).getByText("KEV exposed assets")).toBeInTheDocument();
    expect(within(page).getByText("0 / 1")).toBeInTheDocument();
    expect(within(page).getByText("0 / 5")).toBeInTheDocument();
    expect(within(page).getByText("Investigate seeded incident")).toBeInTheDocument();
    expect(within(page).getByText(/no aggregate security score/i)).toBeInTheDocument();
    expect(within(page).queryByText("72 / 96")).not.toBeInTheDocument();
    expect(within(page).queryByText("119 / 128")).not.toBeInTheDocument();
    expect(within(page).queryByText(/^SIMULATED$/)).not.toBeInTheDocument();
  });

  it("renders my work, security overview, and executive sections", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/overview"] });
    const page = screen.getByTestId("overview-page");

    expect(
      await within(page).findByRole("heading", { name: "Security Overview" }),
    ).toBeInTheDocument();
    expect(within(page).getByRole("heading", { name: "My Work" })).toBeInTheDocument();
    expect(within(page).getByRole("heading", { name: "Executive" })).toBeInTheDocument();
  });

  it("shows the loading skeleton before the overview response arrives", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/overview")) return new Promise(() => undefined);
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/overview"] });
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.queryByText("0 / 5")).not.toBeInTheDocument();
  });

  it("shows an error with retry and does not substitute fixture counts", async () => {
    let fail = true;
    installApiFetch((url) => {
      if (url.includes("/api/v1/overview")) {
        return fail ? jsonResponse({ message: "down" }, 500) : jsonResponse(overviewFixture);
      }
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/overview"] });

    expect(await screen.findByRole("alert")).toHaveTextContent("Overview data unavailable");
    expect(screen.queryByText("72 / 96")).not.toBeInTheDocument();
    expect(screen.queryByText("119 / 128")).not.toBeInTheDocument();

    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("0 / 5")).toBeInTheDocument();
  });

  it("exposes open navigation control for compact layouts", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/overview"] });
    expect(screen.getByRole("button", { name: /open navigation/i })).toBeInTheDocument();
  });
});
