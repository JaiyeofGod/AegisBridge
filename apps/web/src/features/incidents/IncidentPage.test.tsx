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

describe("Incident response", () => {
  it("renders /incidents with simulated labeling and no aggregate score", () => {
    renderWithProviders(<AppRouter />, { initialEntries: ["/incidents"] });
    const page = screen.getByTestId("incidents-page");
    expect(
      within(page).getByRole("heading", { level: 1, name: "Incident response" }),
    ).toBeInTheDocument();
    expect(within(page).getAllByText(/simulated/i).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/no aggregate security score/i).length).toBeGreaterThan(0);
    expect(within(page).queryByText(/overall security score/i)).not.toBeInTheDocument();
    expect(compromiseClaims(page.textContent ?? "")).toEqual([]);
    expect(page.textContent?.toLowerCase()).toContain("no confirmed compromise");
  });

  it("keeps lifecycle status separate from severity", () => {
    renderWithProviders(<AppRouter />, { initialEntries: ["/incidents"] });
    const page = screen.getByTestId("incidents-page");
    expect(within(page).getByRole("columnheader", { name: "Severity" })).toBeInTheDocument();
    expect(within(page).getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(within(page).getAllByText("High").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("Investigating").length).toBeGreaterThan(0);
    expect(within(page).getByTestId("incident-context")).toHaveTextContent("High severity");
    expect(within(page).getByTestId("incident-context")).toHaveTextContent("Investigating status");
    expect(within(page).getByRole("combobox", { name: /^severity$/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /^status$/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /^owner$/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /containment state/i })).toBeInTheDocument();
    expect(within(page).getByRole("searchbox", { name: /search records/i })).toBeInTheDocument();
  });

  it("renders timeline, tasks, indicators, and evidence sections", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRouter />, { initialEntries: ["/incidents"] });
    const page = screen.getByTestId("incidents-page");
    expect(within(page).getByRole("tab", { name: "Incidents" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(page).getAllByText("INC-002").length).toBeGreaterThan(0);
    expect(within(page).getByTestId("incident-timeline")).toHaveTextContent("Incident declared");

    await user.click(within(page).getByRole("tab", { name: "Timeline" }));
    expect(within(page).getByTestId("incident-timeline")).toHaveTextContent("Evidence preserved");

    await user.click(within(page).getByRole("tab", { name: "Tasks" }));
    expect(within(page).getByTestId("incident-tasks")).toHaveTextContent("TASK-201");
    expect(within(page).getAllByText("Overdue").length).toBeGreaterThan(0);

    await user.click(within(page).getByRole("tab", { name: "Indicators" }));
    expect(within(page).getByTestId("incident-indicators")).toHaveTextContent("IOC-301");
    expect(within(page).getAllByText(/not a real malicious indicator/i).length).toBeGreaterThan(0);

    await user.click(within(page).getByRole("tab", { name: "Evidence" }));
    expect(within(page).getByTestId("incident-evidence")).toHaveTextContent("EV-081");
    expect(within(page).getAllByText(/hash recorded \(simulated\)/i).length).toBeGreaterThan(0);
  });
});
