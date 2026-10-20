import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { renderWithProviders } from "@/test/render";

describe("Asset inventory", () => {
  it("renders /assets with simulated labeling and no aggregate security score", () => {
    renderWithProviders(<AppRouter />, { initialEntries: ["/assets"] });
    const page = screen.getByTestId("assets-page");
    expect(within(page).getByRole("heading", { level: 1, name: "Asset inventory" })).toBeInTheDocument();
    expect(within(page).getAllByText(/simulated/i).length).toBeGreaterThan(0);
    expect(within(page).getByText(/There is no aggregate security score/i)).toBeInTheDocument();
    expect(within(page).queryByText(/overall security score/i)).not.toBeInTheDocument();
  });

  it("renders inventory filters and asset id status text", () => {
    renderWithProviders(<AppRouter />, { initialEntries: ["/assets"] });
    const page = screen.getByTestId("assets-page");
    expect(within(page).getByRole("searchbox", { name: /search records/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /asset type/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /criticality/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /environment/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /telemetry status/i })).toBeInTheDocument();
    expect(within(page).getAllByText(/AST-0007/).length).toBeGreaterThan(0);
    expect(within(page).getAllByText("7 open findings").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("Reporting").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("Missing").length).toBeGreaterThan(0);
  });

  it("opens FIN-APP-01 with linked vulnerability, alert, risk, control, and evidence context", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRouter />, { initialEntries: ["/assets"] });
    const inventoryLinks = screen.getAllByRole("link", { name: /FIN-APP-01/i });
    await user.click(inventoryLinks[0]);

    const page = await screen.findByTestId("asset-detail-page");
    expect(within(page).getByRole("heading", { name: "FIN-APP-01" })).toBeInTheDocument();
    expect(within(page).getAllByText(/simulated/i).length).toBeGreaterThan(0);
    expect(within(page).getByText(/no aggregate security score/i)).toBeInTheDocument();
    expect(within(page).getAllByText(/VF-041/).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/AL-104/).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/R-021/).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/SI-02/).length).toBeGreaterThan(0);
    expect(within(page).getByTestId("asset-evidence")).toHaveTextContent("EV-041");
    expect(within(page).getByTestId("asset-profile")).toHaveTextContent("AST-0007");
    expect(within(page).getByText(/Internet-exposed/)).toBeInTheDocument();
  });
});
