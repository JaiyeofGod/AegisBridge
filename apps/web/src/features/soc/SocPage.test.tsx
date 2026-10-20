import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { alertDetail, assetPage, installApiFetch, jsonResponse } from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

function compromiseClaims(text: string) {
  const lower = text.toLowerCase();
  const matches = lower.matchAll(/confirmed compromise/g);
  return [...matches].filter((match) => {
    const prefix = lower.slice(Math.max(0, match.index - 4), match.index);
    return !prefix.trimEnd().endsWith("no");
  });
}

describe("SOC operations", () => {
  it("renders the alert queue from the API with seeded labeling", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/soc"] });
    const page = screen.getByTestId("soc-page");
    expect(
      within(page).getByRole("heading", { level: 1, name: "SOC operations" }),
    ).toBeInTheDocument();
    expect(await within(page).findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();
    expect(within(page).getAllByText(/Development seeded data/i).length).toBeGreaterThan(0);
    expect(within(page).getByText(/not live production/i)).toBeInTheDocument();
    expect(within(page).queryByText(/^SIMULATED$/)).not.toBeInTheDocument();
    expect(within(page).getAllByText("AL-0107").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("AL-0199").length).toBeGreaterThan(0);
    expect(within(page).queryByText("AL-107")).not.toBeInTheDocument();
    expect(within(page).queryByText("AL-104")).not.toBeInTheDocument();
    expect(within(page).getByText(/no aggregate security score/i)).toBeInTheDocument();
    expect(within(page).getAllByText(/Wazuh remains the SIEM of record/i).length).toBeGreaterThan(
      0,
    );
    expect(within(page).getAllByText(/not_connected/).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/selected_metadata/).length).toBeGreaterThan(0);
    expect(compromiseClaims(page.textContent ?? "")).toEqual([]);
    expect(page.textContent?.toLowerCase()).toContain("no confirmed compromise");
    const triage = within(page).getByTestId("triage-context");
    expect(triage).toHaveTextContent("T1059.001");
    expect(triage).toHaveTextContent("PowerShell");
    expect(triage).toHaveTextContent("Execution");
    expect(await within(triage).findByText(/No confirmed compromise/i)).toBeInTheDocument();
    expect(within(page).getByTestId("triage-context")).toHaveTextContent(
      "Raw events are not stored",
    );
    expect(within(page).getByTestId("triage-context")).toHaveTextContent("Not deployed to Wazuh");
  });

  it("shows the loading skeleton before the alert response arrives", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/alerts")) return new Promise(() => undefined);
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/soc"] });
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.queryByText("AL-0107")).not.toBeInTheDocument();
    expect(screen.queryByText("AL-107")).not.toBeInTheDocument();
  });

  it("shows an error with retry and does not substitute fixture rows", async () => {
    let fail = true;
    installApiFetch((url) => {
      if (url.includes("/api/v1/alerts")) {
        return fail
          ? jsonResponse({ message: "down" }, 500)
          : jsonResponse(assetPage([alertDetail]));
      }
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/soc"] });
    expect(await screen.findByRole("alert")).toHaveTextContent("SOC queue unavailable");
    expect(screen.queryByText("AL-107")).not.toBeInTheDocument();
    expect(screen.queryByText("AL-104")).not.toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect((await screen.findAllByText("AL-0107")).length).toBeGreaterThan(0);
  });

  it("maps alert filters to backend query parameters", async () => {
    const { calls } = installApiFetch();
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/soc"] });
    expect((await screen.findAllByText("AL-0199")).length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByRole("combobox", { name: /^severity$/i }), "high");
    await waitFor(() => {
      expect(calls.some((url) => url.includes("severity=high"))).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryAllByText("AL-0199")).toHaveLength(0);
    });
    expect(screen.getAllByText("AL-0107").length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByRole("combobox", { name: /^severity$/i }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: /^status$/i }), "new");
    await user.selectOptions(screen.getByRole("combobox", { name: /source asset/i }), "WIN-WS-07");
    await user.selectOptions(
      screen.getByRole("combobox", { name: /att&ck tactic or technique/i }),
      "T1059.001",
    );
    await user.type(screen.getByRole("searchbox", { name: /search records/i }), "PowerShell");

    await waitFor(() => {
      expect(calls.some((url) => url.includes("status=new"))).toBe(true);
      expect(calls.some((url) => url.includes("asset=WIN-WS-07"))).toBe(true);
      expect(calls.some((url) => url.includes("attack_technique=T1059.001"))).toBe(true);
      expect(calls.some((url) => url.includes("search=PowerShell"))).toBe(true);
    });
    expect(calls.some((url) => url.includes("owner="))).toBe(false);
    expect(screen.queryByText("AL-104")).not.toBeInTheDocument();
  });

  it("renders investigation, detection, and ATT&CK mappings returned by the API", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/soc"] });
    const page = screen.getByTestId("soc-page");
    expect(await within(page).findByText("AL-0107")).toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Investigations" }));
    expect(within(page).getByTestId("soc-investigations")).toHaveTextContent("INV-0012");
    expect(within(page).getByTestId("soc-investigations")).toHaveTextContent(
      "No confirmed compromise",
    );
    expect(within(page).queryByText("Review PowerShell child process")).not.toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Detection rules" }));
    expect(within(page).getByRole("columnheader", { name: "Sigma source" })).toBeInTheDocument();
    expect(within(page).getAllByText("DET-0005").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("Not stored").length).toBeGreaterThan(0);
    expect(within(page).queryByText("DET-005")).not.toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "ATT&CK coverage" }));
    expect(within(page).getAllByText(/enterprise v20\.0/i).length).toBeGreaterThan(0);
    expect(
      within(page).getByText(/does not imply full organizational att&ck coverage/i),
    ).toBeInTheDocument();
    expect(within(page).getAllByText("T1059.001").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("PowerShell").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("not_connected").length).toBeGreaterThan(0);
  });
});
