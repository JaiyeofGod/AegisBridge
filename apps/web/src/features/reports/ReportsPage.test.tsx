import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { renderWithProviders } from "@/test/render";

describe("Reports and analytics", () => {
  it("renders /reports with simulated labeling and no scores", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/reports"] });
    const page = screen.getByTestId("reports-page");
    expect(
      within(page).getByRole("heading", { level: 1, name: "Reports & analytics" }),
    ).toBeInTheDocument();
    expect(within(page).getAllByText(/simulated/i).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/no aggregate security score/i).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/no maturity score/i).length).toBeGreaterThan(0);
    expect(within(page).queryByText(/overall security score/i)).not.toBeInTheDocument();
    expect(within(page).queryByText(/combined cvss/i)).not.toBeInTheDocument();
    expect(within(page).getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("renders report and export status separately from datasets and research", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/reports"] });
    const page = screen.getByTestId("reports-page");
    expect(within(page).getAllByText("Ready").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("Review").length).toBeGreaterThan(0);
    expect(within(page).getByTestId("report-integrity")).toHaveTextContent("RPT-001");

    await user.click(within(page).getByRole("tab", { name: "Reports" }));
    expect(within(page).getAllByText("SOC operations report").length).toBeGreaterThan(0);

    await user.click(within(page).getByRole("tab", { name: "Exports" }));
    const exports = within(page).getByTestId("report-exports");
    expect(exports).toHaveTextContent("EXP-001");
    expect(exports).toHaveTextContent("Completed");
    expect(exports).toHaveTextContent("Pending");
    expect(exports).toHaveTextContent("No file was generated");

    await user.click(within(page).getByRole("tab", { name: "Datasets" }));
    const datasets = within(page).getByTestId("report-datasets");
    for (const name of [
      "Smishing IMC25",
      "CICAPT-IIoT2024 subset",
      "Own cyber-range telemetry",
      "CIC-Trap4Phish 2025",
      "CICIoT2023",
      "PhreshPhish",
      "DataSense CIC IIoT 2025",
      "CIC-PQC_OAV v1",
      "CIC-YNU-IoTMal 2026",
    ]) {
      expect(datasets).toHaveTextContent(name);
    }
    expect(datasets).toHaveTextContent("Not downloaded");

    await user.click(within(page).getByRole("tab", { name: "Research" }));
    expect(within(page).getByTestId("report-research")).toHaveTextContent("RSCH-001");
    expect(within(page).getByTestId("report-research")).toHaveTextContent("No model runtime");
  });
});
