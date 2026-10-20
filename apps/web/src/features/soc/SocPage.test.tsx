import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
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
  it("renders /soc with simulated labeling and no aggregate score", () => {
    renderWithProviders(<AppRouter />, { initialEntries: ["/soc"] });
    const page = screen.getByTestId("soc-page");
    expect(
      within(page).getByRole("heading", { level: 1, name: "SOC operations" }),
    ).toBeInTheDocument();
    expect(within(page).getAllByText(/simulated/i).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/no aggregate security score/i).length).toBeGreaterThan(0);
    expect(within(page).queryByText(/overall security score/i)).not.toBeInTheDocument();
    expect(compromiseClaims(page.textContent ?? "")).toEqual([]);
    expect(page.textContent?.toLowerCase()).toContain("no confirmed compromise");
  });

  it("renders alerts with separate severity and status", () => {
    renderWithProviders(<AppRouter />, { initialEntries: ["/soc"] });
    const page = screen.getByTestId("soc-page");
    expect(within(page).getByRole("columnheader", { name: "Severity" })).toBeInTheDocument();
    expect(within(page).getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(within(page).getAllByText("AL-107").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("AL-104").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("High").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("New").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("Investigation opened").length).toBeGreaterThan(0);
    expect(within(page).getByTestId("triage-context")).toHaveTextContent("T1059.001");
    expect(within(page).getByTestId("triage-context")).toHaveTextContent("No confirmed compromise");
  });

  it("renders investigations, detection rules, and ATT&CK coverage tabs", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRouter />, { initialEntries: ["/soc"] });
    const page = screen.getByTestId("soc-page");
    expect(within(page).getByRole("tab", { name: "Alert queue" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(page).getByRole("searchbox", { name: /search records/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /^severity$/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /^status$/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /source asset/i })).toBeInTheDocument();
    expect(
      within(page).getByRole("combobox", { name: /att&ck tactic or technique/i }),
    ).toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Investigations" }));
    expect(within(page).getByTestId("soc-investigations")).toHaveTextContent("INV-012");

    await user.click(within(page).getByRole("tab", { name: "Detection rules" }));
    expect(within(page).getByRole("columnheader", { name: "Sigma source" })).toBeInTheDocument();
    expect(within(page).getAllByText("DET-005").length).toBeGreaterThan(0);

    await user.click(within(page).getByRole("tab", { name: "ATT&CK coverage" }));
    expect(within(page).getAllByText(/enterprise v20\.0/i).length).toBeGreaterThan(0);
    expect(
      within(page).getByText(/does not imply full organizational att&ck coverage/i),
    ).toBeInTheDocument();
    expect(within(page).getAllByText("T1059.001").length).toBeGreaterThan(0);
  });
});
