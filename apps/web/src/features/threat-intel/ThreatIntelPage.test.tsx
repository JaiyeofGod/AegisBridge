import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { renderWithProviders } from "@/test/render";

function maliciousClaims(text: string) {
  const lower = text.toLowerCase();
  const confirmed = [...lower.matchAll(/confirmed malicious/g)].filter((match) => {
    const prefix = lower.slice(Math.max(0, match.index - 5), match.index);
    return !prefix.trimEnd().endsWith("not");
  });
  const known = lower.includes("known malicious");
  const realWorldFact = /real-world malicious(?! fact)/.test(lower);
  return { confirmed, known, realWorldFact };
}

describe("Threat intelligence", () => {
  it("renders /threat-intelligence with simulated labeling and no aggregate score", () => {
    renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    const page = screen.getByTestId("threat-intel-page");
    expect(
      within(page).getByRole("heading", { level: 1, name: "Threat intelligence" }),
    ).toBeInTheDocument();
    expect(within(page).getAllByText(/simulated/i).length).toBeGreaterThan(0);
    expect(
      within(page).getAllByText(/no aggregate threat or security score/i).length,
    ).toBeGreaterThan(0);
    expect(within(page).queryByText(/threat score/i)).not.toBeInTheDocument();
    expect(within(page).queryByText(/overall security score/i)).not.toBeInTheDocument();
    const claims = maliciousClaims(page.textContent ?? "");
    expect(claims.confirmed).toEqual([]);
    expect(claims.known).toBe(false);
    expect(claims.realWorldFact).toBe(false);
    expect(page.textContent?.toLowerCase()).toContain("not confirmed malicious");
    expect(page.textContent?.toLowerCase()).toContain("not proof of malicious activity");
  });

  it("renders indicator confidence and freshness separately from advisories", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    const page = screen.getByTestId("threat-intel-page");
    expect(within(page).getByRole("tab", { name: "Indicators" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(page).getByRole("columnheader", { name: "Confidence" })).toBeInTheDocument();
    expect(within(page).getByRole("columnheader", { name: "Freshness" })).toBeInTheDocument();
    expect(within(page).getAllByText("High").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("Medium").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("Expiring").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("Expires in 3 days").length).toBeGreaterThan(0);
    expect(within(page).getByRole("searchbox", { name: /search records/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /indicator type/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /^confidence$/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /^source$/i })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: /^freshness$/i })).toBeInTheDocument();
    expect(within(page).getByTestId("intel-context")).toHaveTextContent("198.51.100.24");
    expect(within(page).getByTestId("intel-context")).toHaveTextContent("Not confirmed malicious");

    await user.click(within(page).getByRole("tab", { name: "Advisories" }));
    expect(within(page).getByTestId("intel-advisories")).toHaveTextContent("ADV-011");
    expect(within(page).getAllByText(/requires review/i).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/\bstale\b/i).length).toBeGreaterThan(0);
  });

  it("renders source connection status without a live feed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    const page = screen.getByTestId("threat-intel-page");
    await user.click(within(page).getByRole("tab", { name: "Sources" }));
    const sources = within(page).getByTestId("intel-sources");
    expect(sources).toHaveTextContent("CISA KEV");
    expect(sources).toHaveTextContent("Simulated snapshot");
    expect(sources).toHaveTextContent("Delayed");
    expect(sources).toHaveTextContent("ThreatFox");
    expect(sources).toHaveTextContent("Planned");
    expect(sources).toHaveTextContent("URLhaus");
    expect(sources).toHaveTextContent("Not connected");
  });
});
