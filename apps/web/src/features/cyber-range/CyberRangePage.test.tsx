import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { renderWithProviders } from "@/test/render";

describe("Cyber range", () => {
  it("renders /cyber-range with simulated labeling and no aggregate score", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    expect(
      within(page).getByRole("heading", { level: 1, name: "Cyber range" }),
    ).toBeInTheDocument();
    expect(within(page).getAllByText(/simulated/i).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/not connected/i).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/no aggregate security score/i).length).toBeGreaterThan(0);
    expect(within(page).queryByText(/overall security score/i)).not.toBeInTheDocument();
    expect(within(page).getAllByText(/hypothetical/i).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/not observed telemetry/i).length).toBeGreaterThan(0);
  });

  it("renders the five segments and key lab systems", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    for (const cidr of [
      "10.10.10.0/24",
      "10.10.20.0/24",
      "10.10.30.0/24",
      "10.10.40.0/24",
      "10.10.50.0/24",
    ]) {
      expect(within(page).getAllByText(cidr).length).toBeGreaterThan(0);
    }
    for (const host of [
      "LAB-GW-01",
      "SEC-WAZUH-01",
      "WIN-USER-01",
      "LINUX-APP-01",
      "KALI-RED-01",
    ]) {
      expect(within(page).getAllByText(host).length).toBeGreaterThan(0);
    }
    expect(within(page).getByRole("tab", { name: "Topology" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("renders scenarios and runs", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");

    await user.click(within(page).getByRole("tab", { name: "Segments" }));
    expect(within(page).getByTestId("range-segments")).toHaveTextContent("ATTACK");

    await user.click(within(page).getByRole("tab", { name: "Scenarios" }));
    expect(within(page).getByTestId("range-scenarios")).toHaveTextContent("SCN-001");
    expect(within(page).getByTestId("range-scenarios")).toHaveTextContent("SCN-006");
    expect(within(page).getAllByText("Ready").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("Not connected").length).toBeGreaterThan(0);

    await user.click(within(page).getByRole("tab", { name: "Runs" }));
    expect(within(page).getByTestId("range-runs")).toHaveTextContent("RUN-014");
    expect(within(page).getByTestId("range-runs")).toHaveTextContent("Partial");
    expect(within(page).getByTestId("range-runs")).toHaveTextContent("Validated");
  });
});
