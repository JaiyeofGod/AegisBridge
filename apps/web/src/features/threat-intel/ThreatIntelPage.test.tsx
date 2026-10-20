import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import {
  assetPage,
  emptyThreatIntelSummary,
  indicatorDetail,
  installApiFetch,
  jsonResponse,
  threatIntelSummary,
} from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

describe("Threat intelligence", () => {
  it("renders seeded indicators without calling the data live threat intelligence", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    const page = screen.getByTestId("threat-intel-page");
    expect(
      within(page).getByRole("heading", { level: 1, name: "Threat intelligence" }),
    ).toBeInTheDocument();
    expect(await within(page).findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();
    expect(within(page).getAllByText(/Development seeded data/i).length).toBeGreaterThan(0);
    expect(within(page).getByText(/not live production/i)).toBeInTheDocument();
    expect(within(page).queryByText(/^SIMULATED$/)).not.toBeInTheDocument();
    expect(
      within(page).getAllByText(/no aggregate threat or security score/i).length,
    ).toBeGreaterThan(0);
    expect(within(page).queryByText(/threat score/i)).not.toBeInTheDocument();
    expect(within(page).getAllByText("IOC-0002").length).toBeGreaterThan(0);
    expect(within(page).getByText("203.0.113.50")).toBeInTheDocument();
    expect(within(page).getByText("dev-watch.example")).toBeInTheDocument();
    expect(within(page).queryByText("198.51.100.24")).not.toBeInTheDocument();
    expect(within(page).queryByText("ADV-011")).not.toBeInTheDocument();
    expect(page.textContent?.toLowerCase()).toContain("not live threat intelligence");
    expect(page.textContent?.toLowerCase()).not.toContain("live feed results");
  });

  it("shows the loading skeleton before the threat-intelligence response arrives", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/threat-intelligence")) return new Promise(() => undefined);
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.queryByText("IOC-0002")).not.toBeInTheDocument();
    expect(screen.queryByText("198.51.100.24")).not.toBeInTheDocument();
    expect(screen.queryByText("ADV-011")).not.toBeInTheDocument();
  });

  it("shows an error with retry and does not substitute fixture rows", async () => {
    let fail = true;
    installApiFetch((url) => {
      if (url.includes("/api/v1/threat-intelligence/summary")) {
        return fail ? jsonResponse({ message: "down" }, 500) : jsonResponse(threatIntelSummary);
      }
      if (/\/api\/v1\/threat-intelligence\/indicators\/[^/?]+/.test(url)) {
        return jsonResponse(indicatorDetail("IOC-0001"));
      }
      if (url.includes("/api/v1/threat-intelligence/indicators")) {
        return jsonResponse(assetPage([]));
      }
      if (url.includes("/api/v1/threat-intelligence")) return jsonResponse(assetPage([]));
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Threat intelligence data unavailable",
    );
    expect(screen.queryByText("198.51.100.24")).not.toBeInTheDocument();
    expect(screen.queryByText("ADV-011")).not.toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();
    expect(screen.getByText(/2 reference_only/)).toBeInTheDocument();
    expect(screen.queryByText("ADV-011")).not.toBeInTheDocument();
  });

  it("maps indicator filters to backend query parameters", async () => {
    const { calls } = installApiFetch();
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    expect(await screen.findByText("IOC-0001")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: /indicator type/i }), "domain");
    await waitFor(() => {
      expect(calls.some((url) => url.includes("indicator_type=domain"))).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryByText("203.0.113.50")).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("IOC-0002").length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByRole("combobox", { name: /indicator type/i }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: /^status$/i }), "expired");
    await waitFor(() => {
      expect(calls.some((url) => url.includes("status=expired"))).toBe(true);
    });
    expect(await screen.findByText("IOC-0003")).toBeInTheDocument();
    expect(screen.queryByText("IOC-0002")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: /^status$/i }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: /internal match/i }), "true");
    await user.selectOptions(screen.getByRole("combobox", { name: /^source$/i }), "SRC-0006");
    await user.type(screen.getByRole("searchbox", { name: /search records/i }), "dev-watch");
    await waitFor(() => {
      expect(calls.some((url) => url.includes("internal_match=true"))).toBe(true);
      expect(calls.some((url) => url.includes("source=SRC-0006"))).toBe(true);
      expect(calls.some((url) => url.includes("search=dev-watch"))).toBe(true);
    });
    expect(await screen.findByText("dev-watch.example")).toBeInTheDocument();
    expect(screen.queryByText("198.51.100.24")).not.toBeInTheDocument();
  });

  it("renders indicator detail, ATT&CK mapping, and simulated example labeling", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    const page = screen.getByTestId("threat-intel-page");
    expect(await within(page).findByText("T1059.001")).toBeInTheDocument();
    await user.click(within(page).getAllByRole("button", { name: "IOC-0002" })[0]);
    const context = await within(page).findByTestId("intel-context");
    expect(context).toHaveTextContent("dev-watch.example");
    expect(context).toHaveTextContent("Example domain");
    expect(context).toHaveTextContent("not live threat intelligence");
    expect(context).toHaveTextContent("T1059.001");
    expect(context).toHaveTextContent("PowerShell");
    expect(context).toHaveTextContent("AST-0007");
    expect(context).toHaveTextContent("not a confirmed compromise");
    expect(context).toHaveTextContent("reference_only");
    expect(context).toHaveTextContent("simulated");

    await user.click(within(page).getAllByRole("button", { name: "IOC-0001" })[0]);
    expect(await within(page).findByText(/TEST-NET documentation address/i)).toBeInTheDocument();
  });

  it("renders advisory metadata and source status without a live feed", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    const page = screen.getByTestId("threat-intel-page");
    expect(await within(page).findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Advisories" }));
    const advisories = within(page).getByTestId("intel-advisories");
    expect(advisories).toHaveTextContent("ADV-0001");
    expect(advisories).toHaveTextContent("CVE-2024-21887");
    expect(advisories).toHaveTextContent("NVD was not queried");
    expect(advisories).not.toHaveTextContent("ADV-011");

    await user.click(within(page).getByRole("tab", { name: "Enrichment" }));
    expect(within(page).getByTestId("intel-enrichment")).toHaveTextContent(
      "No enrichment history is stored",
    );

    await user.click(within(page).getByRole("tab", { name: "Sources" }));
    const sources = within(page).getByTestId("intel-sources");
    for (const id of ["SRC-0001", "SRC-0002", "SRC-0003", "SRC-0004", "SRC-0005", "SRC-0006"]) {
      expect(sources).toHaveTextContent(id);
    }
    expect(sources).toHaveTextContent("CISA KEV");
    expect(sources).toHaveTextContent("reference_only");
    expect(sources).toHaveTextContent("not_connected");
    expect(sources).toHaveTextContent("The KEV feed is not connected");
    expect(sources).toHaveTextContent("The NVD feed is not connected");
    expect(sources).toHaveTextContent("The EPSS feed is not connected");
    expect(sources).toHaveTextContent("ThreatFox");
    expect(sources).toHaveTextContent("The ThreatFox feed is not connected");
    expect(sources).toHaveTextContent("URLhaus");
    expect(sources).toHaveTextContent("The URLhaus feed is not connected");
    expect(sources).toHaveTextContent("Not a live feed");
    expect(sources).not.toHaveTextContent("healthy");
    expect(sources).not.toHaveTextContent("configured");
  });

  it("shows empty states when indicators, advisories, and sources are absent", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/threat-intelligence/summary")) {
        return jsonResponse(emptyThreatIntelSummary);
      }
      if (url.includes("/api/v1/threat-intelligence")) return jsonResponse(assetPage([]));
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    const page = screen.getByTestId("threat-intel-page");
    expect(await within(page).findByText("No indicators are stored.")).toBeInTheDocument();
    expect(within(page).getByText("No source records")).toBeInTheDocument();
    expect(within(page).queryByText("ADV-011")).not.toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Advisories" }));
    expect(within(page).getByText("No advisories are stored.")).toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Sources" }));
    expect(within(page).getByText("No source health records are stored.")).toBeInTheDocument();
  });
});
