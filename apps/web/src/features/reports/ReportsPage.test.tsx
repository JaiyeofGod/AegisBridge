import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import {
  assetPage,
  emptyReportsSummary,
  installApiFetch,
  jsonResponse,
  reportDefinitions,
  reportsSummary,
} from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

const secretPattern =
  /sk_live|AKIA[0-9A-Z]{8,}|api[_-]?key\s*[:=]\s*\S+|password\s*[:=]\s*\S+|BEGIN (RSA |OPENSSH )?PRIVATE KEY|eyJ[A-Za-z0-9_-]{10,}|\/var\/|s3:\/\/|storage_uri/i;

describe("Reports and analytics", () => {
  it("renders seeded reports summary counts from the API", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/reports"] });
    const page = screen.getByTestId("reports-page");
    expect(
      within(page).getByRole("heading", { level: 1, name: "Reports & analytics" }),
    ).toBeInTheDocument();
    expect(await within(page).findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();
    expect(within(page).getAllByText(/Development seeded data/i).length).toBeGreaterThan(0);
    expect(within(page).queryByText(/^SIMULATED$/)).not.toBeInTheDocument();
    expect(within(page).getByText(/no aggregate security score/i)).toBeInTheDocument();
    expect(within(page).getByText(/no maturity score/i)).toBeInTheDocument();
    expect(within(page).getByText(/Completed executions: 0/)).toBeInTheDocument();
    expect(within(page).getByText(/Failed: 0/)).toBeInTheDocument();
    expect(within(page).getByText(/Recent executions: 0/)).toBeInTheDocument();
    expect(within(page).getAllByText("Saved report definitions").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("Dataset registry").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("5").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("3").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("9").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("2").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("4").length).toBeGreaterThan(0);
    expect(page.textContent ?? "").not.toMatch(secretPattern);
    expect(within(page).queryByText("RPT-001")).not.toBeInTheDocument();
    expect(within(page).queryByText("SOC operations report")).not.toBeInTheDocument();
    expect(within(page).queryByText("EXP-001")).not.toBeInTheDocument();
  });

  it("shows the loading skeleton before the reports response arrives", async () => {
    installApiFetch((url) => {
      if (
        url.includes("/api/v1/reports") ||
        url.includes("/api/v1/datasets") ||
        url.includes("/api/v1/dataset-experiments")
      ) {
        return new Promise(() => undefined);
      }
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/reports"] });
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.queryByText("RPT-0001")).not.toBeInTheDocument();
    expect(screen.queryByText("RPT-001")).not.toBeInTheDocument();
    expect(screen.queryByText("EXP-001")).not.toBeInTheDocument();
  });

  it("shows an error with retry and does not substitute fixture rows", async () => {
    let fail = true;
    installApiFetch((url) => {
      if (url.includes("/api/v1/reports/summary")) {
        return fail ? jsonResponse({ message: "down" }, 500) : jsonResponse(reportsSummary);
      }
      if (
        url.includes("/api/v1/reports") ||
        url.includes("/api/v1/datasets") ||
        url.includes("/api/v1/dataset-experiments")
      ) {
        return jsonResponse(assetPage([]));
      }
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/reports"] });
    expect(await screen.findByRole("alert")).toHaveTextContent("Reports data unavailable");
    expect(screen.queryByText("RPT-001")).not.toBeInTheDocument();
    expect(screen.queryByText("EXP-001")).not.toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();
    expect(screen.getByText(/Completed executions: 0/)).toBeInTheDocument();
    expect(screen.queryByText("RPT-001")).not.toBeInTheDocument();
  });

  it("renders report definitions without inventing generated files or a running scheduler", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/reports"] });
    const page = screen.getByTestId("reports-page");
    expect(await within(page).findByText("RPT-0001")).toBeInTheDocument();
    const integrity = within(page).getByTestId("report-integrity");
    expect(integrity).toHaveTextContent("RPT-0001");
    expect(integrity).toHaveTextContent("Executive Security Summary");
    expect(integrity).toHaveTextContent("No generated files are stored");
    expect(integrity).toHaveTextContent("schedule_defined");
    expect(integrity).toHaveTextContent("not a running scheduler");
    expect(integrity).toHaveTextContent("Not recorded");
    expect(integrity).not.toHaveTextContent("EXP-001");

    await user.click(within(page).getByRole("tab", { name: "Reports" }));
    expect(within(page).getByText("Incident Summary Report")).toBeInTheDocument();
    expect(within(page).getAllByText("RPT-0005").length).toBeGreaterThan(0);
    expect(within(page).queryByText("SOC operations report")).not.toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Exports" }));
    const exports = within(page).getByTestId("report-exports");
    expect(exports).toHaveTextContent("No generated report files are stored");
    expect(exports).toHaveTextContent("Completed executions: 0");
    expect(exports).not.toHaveTextContent("EXP-001");
    expect(exports).not.toHaveTextContent("Pending");
  });

  it("maps report filters to supported API parameters", async () => {
    const { calls } = installApiFetch();
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/reports"] });
    const page = screen.getByTestId("reports-page");
    await user.click(await within(page).findByRole("tab", { name: "Reports" }));
    await user.selectOptions(within(page).getByLabelText("Status"), "review");
    await user.selectOptions(within(page).getByLabelText("Report type"), "incident_summary");
    expect(
      calls.some(
        (url) =>
          url.includes("/api/v1/reports/definitions") &&
          url.includes("status=review") &&
          url.includes("report_type=incident_summary"),
      ),
    ).toBe(true);
    expect(within(page).getByText("Incident Summary Report")).toBeInTheDocument();
    expect(within(page).queryByText("Executive Security Summary")).not.toBeInTheDocument();
  });

  it("renders dataset registry metadata with not_downloaded semantics", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/reports"] });
    const page = screen.getByTestId("reports-page");
    await user.click(await within(page).findByRole("tab", { name: "Datasets" }));
    const datasets = within(page).getByTestId("report-datasets");
    for (const name of [
      "Smishing Dataset – IMC25",
      "CICAPT-IIoT2024 subset",
      "CICIoT2023",
      "DataSense CIC IIoT 2025",
      "CIC-Trap4Phish 2025",
      "PhreshPhish",
      "CIC-PQC_OAV v1",
      "CIC-YNU-IoTMal 2026",
      "AegisBridge internal telemetry",
    ]) {
      expect(datasets).toHaveTextContent(name);
    }
    expect(datasets).toHaveTextContent("Not downloaded");
    expect(datasets).toHaveTextContent("Verification required");
    expect(datasets).not.toHaveTextContent("locally available");
    expect(datasets).not.toHaveTextContent("Own cyber-range telemetry");

    const detail = within(page).getByTestId("dataset-detail");
    expect(detail).toHaveTextContent("DS-0001");
    expect(detail).toHaveTextContent("not_downloaded");
    expect(detail).toHaveTextContent("Registry metadata only");
    expect(detail).toHaveTextContent("No dataset files are stored");
    expect(detail).toHaveTextContent("Rows Not recorded");
    expect(detail).toHaveTextContent("Features Not recorded");
    expect(detail).not.toHaveTextContent("sha256");
    expect(detail.textContent ?? "").not.toMatch(secretPattern);
  });

  it("maps dataset filters to supported API parameters", async () => {
    const { calls } = installApiFetch();
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/reports"] });
    const page = screen.getByTestId("reports-page");
    await user.click(await within(page).findByRole("tab", { name: "Datasets" }));
    await user.selectOptions(within(page).getByLabelText("Lifecycle status"), "not_downloaded");
    await user.selectOptions(within(page).getByLabelText("Verification"), "verification_required");
    expect(
      calls.some(
        (url) =>
          url.includes("/api/v1/datasets") &&
          url.includes("status=not_downloaded") &&
          url.includes("verification_status=verification_required"),
      ),
    ).toBe(true);
    expect(within(page).getByTestId("report-datasets")).toHaveTextContent("PhreshPhish");
    expect(within(page).getByTestId("report-datasets")).toHaveTextContent("CIC-YNU-IoTMal 2026");
    expect(within(page).getByTestId("report-datasets")).not.toHaveTextContent(
      "Smishing Dataset – IMC25",
    );
  });

  it("renders experiment metadata exactly as stored without performance claims", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/reports"] });
    const page = screen.getByTestId("reports-page");
    await user.click(await within(page).findByRole("tab", { name: "Research" }));
    const research = within(page).getByTestId("report-research");
    expect(research).toHaveTextContent("RSCH-0001");
    expect(research).toHaveTextContent(
      "Category counts were tabulated from the registry note. No model runtime was used.",
    );
    expect(research).toHaveTextContent("RSCH-0004");
    expect(research).toHaveTextContent("No metrics or results are stored.");
    expect(research).not.toHaveTextContent("accuracy");
    expect(research).not.toHaveTextContent("F1");

    await user.click(within(research).getByRole("button", { name: /RSCH-0004/ }));
    const detail = within(page).getByTestId("experiment-detail");
    expect(detail).toHaveTextContent("RSCH-0004");
    expect(detail).toHaveTextContent("DS-0005");
    expect(detail).toHaveTextContent("No metrics or results are stored.");
    expect(detail).toHaveTextContent("not a stronger model-performance claim");
    expect(detail).toHaveTextContent("Not recorded");
  });

  it("maps experiment filters to supported API parameters", async () => {
    const { calls } = installApiFetch();
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/reports"] });
    const page = screen.getByTestId("reports-page");
    await user.click(await within(page).findByRole("tab", { name: "Research" }));
    await user.selectOptions(within(page).getByLabelText("Status"), "planned");
    await user.selectOptions(within(page).getByLabelText("Dataset"), "DS-0005");
    expect(
      calls.some(
        (url) =>
          url.includes("/api/v1/dataset-experiments") &&
          url.includes("status=planned") &&
          url.includes("dataset_id=DS-0005"),
      ),
    ).toBe(true);
    expect(within(page).getByTestId("report-research")).toHaveTextContent("RSCH-0004");
    expect(within(page).getByTestId("report-research")).not.toHaveTextContent("RSCH-0001");
  });

  it("shows empty states when no report, dataset, or experiment rows are stored", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/reports/summary")) return jsonResponse(emptyReportsSummary);
      if (
        url.includes("/api/v1/reports") ||
        url.includes("/api/v1/datasets") ||
        url.includes("/api/v1/dataset-experiments")
      ) {
        return jsonResponse(assetPage([]));
      }
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/reports"] });
    const page = screen.getByTestId("reports-page");
    expect(await within(page).findByText("No report definitions are stored.")).toBeInTheDocument();
    expect(within(page).queryByText("RPT-0001")).not.toBeInTheDocument();
    expect(within(page).queryByText("RPT-001")).not.toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Datasets" }));
    expect(within(page).getByTestId("report-datasets")).toHaveTextContent(
      "No datasets are stored.",
    );

    await user.click(within(page).getByRole("tab", { name: "Research" }));
    expect(within(page).getByTestId("report-research")).toHaveTextContent(
      "No experiments are stored.",
    );
  });

  it("does not fall back to the old reports fixture catalog", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/reports/summary")) return jsonResponse(reportsSummary);
      if (url.includes("/api/v1/reports/definitions")) {
        return jsonResponse(assetPage([reportDefinitions[0]]));
      }
      if (url.includes("/api/v1/datasets") || url.includes("/api/v1/dataset-experiments")) {
        return jsonResponse(assetPage([]));
      }
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/reports"] });
    const page = screen.getByTestId("reports-page");
    expect(await within(page).findByText("RPT-0001")).toBeInTheDocument();
    expect(within(page).queryByText("RPT-001")).not.toBeInTheDocument();
    expect(within(page).queryByText("SOC operations report")).not.toBeInTheDocument();
    expect(within(page).queryByText("Detection experiment comparison")).not.toBeInTheDocument();
    expect(within(page).queryByText("EXP-001")).not.toBeInTheDocument();
  });
});
