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
    expect(within(page).getAllByText("203.0.113.50").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("dev-watch.example").length).toBeGreaterThan(0);
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
    expect((await screen.findAllByText("IOC-0001")).length).toBeGreaterThan(0);
    expect(calls.some((url) => url.includes("page_size=25"))).toBe(true);
    expect(calls.some((url) => url.includes("page_size=1000"))).toBe(false);

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
    expect((await screen.findAllByText("IOC-0003")).length).toBeGreaterThan(0);
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
    expect((await screen.findAllByText("dev-watch.example")).length).toBeGreaterThan(0);
    expect(screen.queryByText("198.51.100.24")).not.toBeInTheDocument();
  });

  it("renders indicator detail, ATT&CK mapping, and simulated example labeling", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    const page = screen.getByTestId("threat-intel-page");
    expect((await within(page).findAllByText("IOC-0002")).length).toBeGreaterThan(0);
    await user.click(within(page).getAllByRole("button", { name: "IOC-0002" })[0]);
    const context = await within(page).findByTestId("intel-context");
    expect(context).toHaveTextContent("dev-watch.example");
    expect(context).toHaveTextContent("Simulated");
    expect(context).toHaveTextContent("T1059.001");
    expect(context).toHaveTextContent("PowerShell");
    expect(context).toHaveTextContent("AST-0007");
    expect(context).toHaveTextContent("not a confirmed compromise");
    expect(context).toHaveTextContent("reference_only");
    expect(context).toHaveTextContent("AegisBridge confidence");
    expect(context).not.toHaveTextContent("Malware family");
    expect(context).not.toHaveTextContent("Source confidence");
    expect(within(context).getByTestId("indicator-value").closest("a")).toBeNull();

    await user.click(within(page).getAllByRole("button", { name: "IOC-0001" })[0]);
    expect(
      await within(page).findByText(
        "Simulated development indicator. External feeds were not queried.",
      ),
    ).toBeInTheDocument();
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

  it("shows ThreatFox, URLhaus, and simulated provenance without linking the indicator URL", async () => {
    const hiddenUuid = "11111111-2222-4333-8444-555555555555";
    const hiddenKey = "abusech-secret-key";
    const maliciousUrl = "https://evil.example/payload?x=<script>alert(1)</script>";
    installApiFetch((url) => {
      if (url.includes("/api/v1/threat-intelligence/summary")) {
        return jsonResponse({
          ...threatIntelSummary,
          data_origin: "mixed",
          active_indicator_count: 3,
          semantics: "Counts include stored development records and ingested feed rows.",
        });
      }
      if (/\/api\/v1\/threat-intelligence\/indicators\/[^/?]+/.test(url)) {
        const id = decodeURIComponent(url.split("/indicators/")[1]?.split("?")[0] ?? "");
        const row = feedRows().find((item) => item.list.id === id);
        return jsonResponse(
          row ? { ...row.detail, internal_uuid: hiddenUuid } : { message: "missing" },
          row ? 200 : 404,
        );
      }
      if (url.includes("/api/v1/threat-intelligence/indicators")) {
        return jsonResponse(assetPage(feedRows().map((item) => item.list)));
      }
      if (url.includes("/api/v1/threat-intelligence/sources")) {
        return jsonResponse(
          assetPage([
            {
              id: "SRC-0004",
              name: "ThreatFox",
              provider: "abuse.ch",
              purpose: "Recent indicators.",
              connection_status: "healthy",
              notes: "Most recent read succeeded.",
            },
            {
              id: "SRC-0005",
              name: "URLhaus",
              provider: "abuse.ch",
              purpose: "Recent URLs.",
              connection_status: "healthy",
              notes: "Most recent read succeeded.",
            },
            {
              id: "SRC-0006",
              name: "Internal simulated set",
              provider: "internal",
              purpose: "Development indicators.",
              connection_status: "reference_only",
              notes: "Simulated rows.",
            },
          ]),
        );
      }
      return undefined;
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    const page = screen.getByTestId("threat-intel-page");
    expect((await within(page).findAllByText("ThreatFox")).length).toBeGreaterThan(0);
    expect(within(page).getAllByText("URLhaus").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("Internal simulated set").length).toBeGreaterThan(0);
    expect(within(page).getByText("MIXED ORIGIN")).toBeInTheDocument();
    expect(within(page).queryByText("DEVELOPMENT / SEEDED")).not.toBeInTheDocument();
    expect(page.textContent).not.toContain("external feeds are not connected");
    expect(page.textContent).not.toContain(hiddenUuid);
    expect(page.textContent).not.toContain(hiddenKey);
    expect(page.innerHTML).not.toContain("dangerouslySetInnerHTML");

    await user.click(within(page).getAllByRole("button", { name: "IOC-9001" })[0]);
    expect(await within(page).findByText("External feed")).toBeInTheDocument();
    const threatFox = within(page).getByTestId("intel-context");
    expect(threatFox).toHaveTextContent("IP");
    expect(threatFox).toHaveTextContent("IPv4");
    expect(threatFox).toHaveTextContent("ThreatFox");
    expect(threatFox).toHaveTextContent("botnet_cc");
    expect(threatFox).toHaveTextContent("Dridex");
    expect(threatFox).toHaveTextContent("Source confidence");
    expect(threatFox).toHaveTextContent("75");
    expect(threatFox).toHaveTextContent("AegisBridge confidence");
    expect(threatFox).toHaveTextContent("Not assigned");
    expect(threatFox).toHaveTextContent("Fetched by AegisBridge");
    expect(threatFox).toHaveTextContent("<script>alert(1)</script>");
    expect(threatFox.querySelector("script")).toBeNull();
    expect(threatFox.querySelector("img")).toBeNull();
    const reference = within(threatFox).getByRole("link", { name: "Source reference" });
    expect(reference).toHaveAttribute("href", "https://threatfox.abuse.ch/ioc/1");
    expect(reference).toHaveAttribute("rel", "noopener noreferrer");
    expect(reference).toHaveAttribute("target", "_blank");

    await user.click(within(page).getAllByRole("button", { name: "IOC-9002" })[0]);
    expect(await within(page).findByText("malware_download")).toBeInTheDocument();
    const urlhaus = within(page).getByTestId("intel-context");
    expect(urlhaus).toHaveTextContent("URLhaus");
    expect(urlhaus).toHaveTextContent("External feed");
    expect(urlhaus).toHaveTextContent("malware_download");
    expect(urlhaus).toHaveTextContent("Source status");
    expect(urlhaus).toHaveTextContent("online");
    expect(urlhaus).toHaveTextContent("Not assigned");
    expect(urlhaus).toHaveTextContent("Fetched by AegisBridge");
    expect(urlhaus).toHaveTextContent("<img src=x onerror=alert(1)>");
    expect(urlhaus).toHaveTextContent(maliciousUrl);
    expect(urlhaus.querySelector("script")).toBeNull();
    expect(urlhaus.querySelector("img")).toBeNull();
    for (const link of urlhaus.querySelectorAll("a")) {
      expect(link.getAttribute("href") ?? "").not.toContain("evil.example");
      expect(link.textContent).not.toContain("evil.example");
    }
    for (const link of page.querySelectorAll("a")) {
      expect(link.getAttribute("href") ?? "").not.toContain("evil.example");
    }

    await user.click(within(page).getAllByRole("button", { name: "IOC-9003" })[0]);
    expect(await within(page).findByText("Simulated development indicator.")).toBeInTheDocument();
    const simulated = within(page).getByTestId("intel-context");
    expect(simulated).toHaveTextContent("Simulated");
    expect(simulated).toHaveTextContent("Internal simulated set");
    expect(simulated).not.toHaveTextContent("Malware family");
    expect(simulated).not.toHaveTextContent("Source confidence");
    expect(simulated).not.toHaveTextContent("Source status");
    expect(simulated).toHaveTextContent("Low");
  });

  it("filters and pages indicators on the server and resets to page 1", async () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({
      id: `IOC-${String(9100 + index).padStart(4, "0")}`,
      indicator_type: index === 0 ? "url" : "ip",
      value: index === 0 ? "https://feed.example/watch" : `203.0.113.${index}`,
      confidence: null,
      severity: null,
      source: {
        id: index % 2 === 0 ? "SRC-0004" : "SRC-0005",
        name: index % 2 === 0 ? "ThreatFox" : "URLhaus",
        connection_status: "healthy",
      },
      first_seen: "2026-10-24T12:00:00Z",
      last_seen: "2026-10-24T12:00:00Z",
      status: "active",
      internal_match: false,
      attack_technique_id: null,
      matched_asset_id: null,
    }));
    const { calls } = installApiFetch((url) => {
      if (url.includes("/api/v1/threat-intelligence/summary")) {
        return jsonResponse({ ...threatIntelSummary, data_origin: "external_feed" });
      }
      if (/\/api\/v1\/threat-intelligence\/indicators\/[^/?]+/.test(url)) {
        const id = decodeURIComponent(url.split("/indicators/")[1]?.split("?")[0] ?? "");
        const row = rows.find((item) => item.id === id) ?? rows[0];
        return jsonResponse({
          ...row,
          summary: "Feed observation.",
          attack: null,
          matched_asset: null,
          data_origin: "external_feed",
          tags: [],
        });
      }
      if (url.includes("/api/v1/threat-intelligence/indicators")) {
        const params = new URL(url, "http://localhost").searchParams;
        let items = rows;
        const type = params.get("indicator_type");
        const source = params.get("source");
        const search = params.get("search")?.toLowerCase();
        if (type) items = items.filter((item) => item.indicator_type === type);
        if (source) items = items.filter((item) => item.source.id === source);
        if (search) items = items.filter((item) => item.value.toLowerCase().includes(search));
        const page = Number(params.get("page") ?? "1") || 1;
        const pageSize = Number(params.get("page_size") ?? "25") || 25;
        return jsonResponse(assetPage(items, page, pageSize));
      }
      return undefined;
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    expect((await screen.findAllByText("IOC-9100")).length).toBeGreaterThan(0);
    expect(screen.getByTestId("indicator-pager-status")).toHaveTextContent("Page 1 of 2");
    expect(screen.queryByText("IOC-9125")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => {
      expect(calls.some((url) => url.includes("page=2") && url.includes("page_size=25"))).toBe(
        true,
      );
    });
    expect((await screen.findAllByText("IOC-9125")).length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByRole("combobox", { name: /indicator type/i }), "url");
    await waitFor(() => {
      expect(
        calls.some((url) => url.includes("indicator_type=url") && url.includes("page=1")),
      ).toBe(true);
    });
    expect((await screen.findAllByText("IOC-9100")).length).toBeGreaterThan(0);
    expect(screen.queryByText("IOC-9125")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: /indicator type/i }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: /^source$/i }), "SRC-0004");
    await user.type(screen.getByRole("searchbox", { name: /search records/i }), "feed.example");
    await waitFor(() => {
      expect(calls.some((url) => url.includes("source=SRC-0004"))).toBe(true);
      expect(
        calls.some((url) => url.includes("search=feed.example") && url.includes("page=1")),
      ).toBe(true);
    });
  });

  it("explains a healthy source as a successful read", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/threat-intelligence/sources")) {
        return jsonResponse(
          assetPage([
            {
              id: "SRC-0004",
              name: "ThreatFox",
              provider: "abuse.ch",
              purpose: "Recent indicators.",
              connection_status: "healthy",
              notes: "Most recent read succeeded.",
            },
            {
              id: "SRC-0005",
              name: "URLhaus",
              provider: "abuse.ch",
              purpose: "Recent URLs.",
              connection_status: "healthy",
              notes: "Most recent read succeeded.",
            },
          ]),
        );
      }
      return undefined;
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    const page = screen.getByTestId("threat-intel-page");
    await user.click(await within(page).findByRole("tab", { name: "Sources" }));
    const sources = within(page).getByTestId("intel-sources");
    expect(sources).toHaveTextContent("ThreatFox");
    expect(sources).toHaveTextContent("URLhaus");
    expect(sources).toHaveTextContent("Healthy");
    expect(sources).toHaveTextContent("most recent feed read succeeded");
    expect(sources).toHaveTextContent("not guaranteed uptime");
    expect(sources).not.toHaveTextContent("permanently down");
  });

  it("shows an empty filter result without dropping the list on detail failure", async () => {
    installApiFetch((url) => {
      if (/\/api\/v1\/threat-intelligence\/indicators\/[^/?]+/.test(url)) {
        return jsonResponse({ message: "detail down" }, 500);
      }
      if (
        url.includes("/api/v1/threat-intelligence/indicators") &&
        url.includes("status=retracted")
      ) {
        return jsonResponse(assetPage([]));
      }
      return undefined;
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    expect((await screen.findAllByText("IOC-0001")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Indicator record unavailable")).toBeInTheDocument();
    expect(screen.getAllByText("IOC-0002").length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByRole("combobox", { name: /^status$/i }), "retracted");
    expect(await screen.findByText("No indicators match these filters.")).toBeInTheDocument();
  });
});

function feedRows() {
  const threatFox = {
    id: "IOC-9001",
    indicator_type: "ip",
    value: "198.51.100.8",
    confidence: null,
    severity: null,
    source: { id: "SRC-0004", name: "ThreatFox", connection_status: "healthy" },
    first_seen: "2026-10-24T11:00:00Z",
    last_seen: "2026-10-24T12:00:00Z",
    status: "active",
    internal_match: false,
    attack_technique_id: null,
    matched_asset_id: null,
  };
  const urlhaus = {
    id: "IOC-9002",
    indicator_type: "url",
    value: "https://evil.example/payload?x=<script>alert(1)</script>",
    confidence: null,
    severity: null,
    source: { id: "SRC-0005", name: "URLhaus", connection_status: "healthy" },
    first_seen: "2026-10-24T11:00:00Z",
    last_seen: "2026-10-24T12:00:00Z",
    status: "active",
    internal_match: false,
    attack_technique_id: null,
    matched_asset_id: null,
  };
  const simulated = {
    id: "IOC-9003",
    indicator_type: "domain",
    value: "dev-watch.example",
    confidence: "low",
    severity: null,
    source: { id: "SRC-0006", name: "Internal simulated set", connection_status: "reference_only" },
    first_seen: "2026-10-19T21:12:00Z",
    last_seen: "2026-10-19T21:12:00Z",
    status: "active",
    internal_match: false,
    attack_technique_id: null,
    matched_asset_id: null,
  };
  return [
    {
      list: threatFox,
      detail: {
        ...threatFox,
        summary: "ThreatFox observation. Not a compromise.",
        attack: null,
        matched_asset: null,
        data_origin: "external_feed",
        indicator_subtype: "ipv4",
        threat_type: "botnet_cc",
        malware_family: "Dridex",
        tags: ["<script>alert(1)</script>", "exe"],
        source_status: null,
        source_confidence: 75,
        reference_url: "https://threatfox.abuse.ch/ioc/1",
        fetched_at: "2026-10-24T12:05:00Z",
        api_key: "abusech-secret-key",
      },
    },
    {
      list: urlhaus,
      detail: {
        ...urlhaus,
        summary: "URLhaus observation. Not a compromise.",
        attack: null,
        matched_asset: null,
        data_origin: "external_feed",
        indicator_subtype: "url",
        threat_type: "malware_download",
        malware_family: "<img src=x onerror=alert(1)>",
        tags: ["elf", "tag-2", "tag-3", "tag-4", "tag-5", "tag-6", "tag-7", "tag-8", "tag-9"],
        source_status: "online",
        source_confidence: null,
        reference_url: "https://urlhaus.abuse.ch/url/9/",
        fetched_at: "2026-10-24T12:06:00Z",
      },
    },
    {
      list: simulated,
      detail: {
        ...simulated,
        summary: "Simulated development indicator.",
        attack: null,
        matched_asset: null,
        data_origin: "simulated",
        indicator_subtype: "domain",
        threat_type: null,
        malware_family: null,
        tags: [],
        source_status: null,
        source_confidence: null,
        reference_url: null,
        fetched_at: null,
      },
    },
  ];
}
