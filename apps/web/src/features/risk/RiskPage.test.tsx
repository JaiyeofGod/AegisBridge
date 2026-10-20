import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { riskBand, riskScore } from "@/features/risk/risk-model";
import { renderWithProviders } from "@/test/render";

describe("Risk page", () => {
  it("renders /risks with simulated labeling and no aggregate security score", () => {
    renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    const page = screen.getByTestId("risks-page");
    expect(within(page).getByRole("heading", { name: "Risk register" })).toBeInTheDocument();
    expect(within(page).getAllByText(/simulated/i).length).toBeGreaterThan(0);
    expect(within(page).getByText(/There is no aggregate security score/i)).toBeInTheDocument();
    expect(within(page).queryByText(/overall security score/i)).not.toBeInTheDocument();
    expect(within(page).queryByText(/enterprise security score/i)).not.toBeInTheDocument();
  });

  it("shows likelihood, impact, and likelihood × impact semantics", () => {
    expect(riskScore(3, 4)).toBe(12);
    expect(riskScore(5, 5)).toBe(25);
    expect(riskBand(12).label).toBe("High");
    expect(riskBand(16).label).toBe("Critical");
    expect(riskBand(6).label).toBe("Medium");
    expect(riskBand(4).label).toBe("Low");

    renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    const page = screen.getByTestId("risks-page");
    expect(within(page).getByRole("columnheader", { name: "Likelihood" })).toBeInTheDocument();
    expect(within(page).getByRole("columnheader", { name: "Impact" })).toBeInTheDocument();
    expect(within(page).getByRole("columnheader", { name: "Risk score" })).toBeInTheDocument();
    expect(within(page).getAllByText(/3 · Possible/i).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/4 · Major/i).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/likelihood × impact/i).length).toBeGreaterThan(0);
  });

  it("renders search, risk level, treatment status, and owner filters", () => {
    renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    const page = screen.getByTestId("risks-page");
    expect(within(page).getByRole("searchbox", { name: /search records/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /risk level/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /treatment status/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /^owner$/i })).toBeInTheDocument();
  });

  it("keeps risk management navigable from the sidebar", () => {
    renderWithProviders(<AppRouter />, { initialEntries: ["/overview"] });
    expect(screen.getByRole("link", { name: "Risk Management" })).toHaveAttribute("href", "/risks");
  });
});
