import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppRouter } from "@/app/router";
import { renderWithProviders } from "@/test/render";

describe("Overview page", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve({
          ok: true,
          json: async () => ({ status: "ok", service: "aegisbridge" }),
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders overview metrics with simulated labeling", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/overview"] });

    const page = screen.getByTestId("overview-page");
    expect(within(page).getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(within(page).getAllByText(/simulated/i).length).toBeGreaterThan(0);

    expect(within(page).getByText("KEV exposed assets")).toBeInTheDocument();
    expect(within(page).getByText("7")).toBeInTheDocument();
    expect(within(page).getByText("Unique KEV CVEs").previousSibling?.textContent).toBeDefined();
    expect(within(page).getByText("4")).toBeInTheDocument();
    expect(within(page).getByText("Open incidents")).toBeInTheDocument();
    expect(within(page).getByText("3")).toBeInTheDocument();
    expect(within(page).getByText("72 / 96")).toBeInTheDocument();
    expect(within(page).getByText("119 / 128")).toBeInTheDocument();
    expect(within(page).getByText(/no aggregate security score/i)).toBeInTheDocument();
  });

  it("renders my work, security overview, and executive sections", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/overview"] });
    const page = screen.getByTestId("overview-page");

    expect(within(page).getByRole("heading", { name: "Security Overview" })).toBeInTheDocument();
    expect(within(page).getByRole("heading", { name: "My Work" })).toBeInTheDocument();
    expect(within(page).getByRole("heading", { name: "Executive" })).toBeInTheDocument();
  });

  it("exposes open navigation control for compact layouts", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/overview"] });
    expect(screen.getByRole("button", { name: /open navigation/i })).toBeInTheDocument();
  });
});
