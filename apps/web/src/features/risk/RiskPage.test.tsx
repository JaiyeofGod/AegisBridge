import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { riskBand, riskScore } from "@/features/risk/risk-model";
import { installApiFetch, jsonResponse, riskDetail } from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

describe("Risk page", () => {
  beforeEach(() => {
    installApiFetch();
  });

  it("renders the risk register from the API with seeded labeling", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    const page = screen.getByTestId("risks-page");
    expect(within(page).getByRole("heading", { name: "Risk register" })).toBeInTheDocument();
    expect(await within(page).findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();
    expect(within(page).getByText(/Development seeded data/i)).toBeInTheDocument();
    expect(within(page).getByText(/not live production/i)).toBeInTheDocument();
    expect(within(page).getAllByText(/RISK-0021/).length).toBeGreaterThan(0);
    expect(within(page).getByText(/There is no aggregate security score/i)).toBeInTheDocument();
    expect(within(page).queryByText("R-021")).not.toBeInTheDocument();
    expect(within(page).queryByText("R-014")).not.toBeInTheDocument();
    expect(within(page).queryByText(/^SIMULATED$/)).not.toBeInTheDocument();
  });

  it("keeps likelihood, impact, and score separate", async () => {
    expect(riskScore(3, 4)).toBe(12);
    expect(riskScore(4, 5)).toBe(20);
    expect(riskBand(20).label).toBe("Critical");

    await renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    const page = screen.getByTestId("risks-page");
    expect(
      await within(page).findByRole("columnheader", { name: "Likelihood" }),
    ).toBeInTheDocument();
    expect(within(page).getByRole("columnheader", { name: "Impact" })).toBeInTheDocument();
    expect(within(page).getByRole("columnheader", { name: "Risk score" })).toBeInTheDocument();
    expect(await within(page).findAllByText(/4 · Likely/i)).not.toHaveLength(0);
    expect(within(page).getAllByText(/5 · Severe/i).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/likelihood × impact/i).length).toBeGreaterThan(0);
    expect(within(page).getByText(/Residual score Not recorded/i)).toBeInTheDocument();
    expect(riskDetail.score).toBe(20);
  });

  it("shows the loading skeleton before the risk response arrives", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/risks")) return new Promise(() => undefined);
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.queryByText("RISK-0021")).not.toBeInTheDocument();
  });

  it("shows an error with retry and does not substitute fixture rows", async () => {
    let fail = true;
    installApiFetch((url) => {
      if (url.includes("/api/v1/risks")) {
        return fail ? jsonResponse({ message: "down" }, 500) : jsonResponse(assetPageOfRisks());
      }
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    expect(await screen.findByRole("alert")).toHaveTextContent("Risk data unavailable");
    expect(screen.queryByText("R-021")).not.toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect((await screen.findAllByText(/RISK-0021/)).length).toBeGreaterThan(0);
  });

  it("maps risk filters to backend query parameters", async () => {
    const { calls } = installApiFetch();
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    expect((await screen.findAllByText(/RISK-0002/)).length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByRole("combobox", { name: /risk level/i }), "critical");

    await waitFor(() => {
      expect(calls.some((url) => url.includes("risk_level=critical"))).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryAllByText(/RISK-0002/)).toHaveLength(0);
    });
    expect(screen.getAllByText(/RISK-0021/).length).toBeGreaterThan(0);
  });

  it("keeps risk management navigable from the sidebar", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/overview"] });
    expect(screen.getByRole("link", { name: "Risk Management" })).toHaveAttribute("href", "/risks");
  });
});

function assetPageOfRisks() {
  return {
    page: 1,
    page_size: 100,
    total: 1,
    items: [riskDetail],
  };
}
