import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { anchorOnBox, offsetsForBundle, stableOffset } from "@/features/cyber-range/catalogEdges";
import {
  catalogEdgeCaption,
  catalogEdgeShowsArrow,
  catalogEdgeTouchesSelection,
  catalogRelationState,
  catalogRelationshipStatements,
  directCatalogPeerIds,
  mapLabSystemRelationship,
  type LabSystemRelationshipView,
} from "@/features/cyber-range/mapCyberRange";
import motionCss from "@/styles/index.css?raw";
import {
  assetPage,
  cyberRangeSummary,
  emptyCyberRangeSummary,
  installApiFetch,
  jsonResponse,
} from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

const secretPattern =
  /sk_live|AKIA[0-9A-Z]{8,}|api[_-]?key\s*[:=]\s*\S+|password\s*[:=]\s*\S+|BEGIN (RSA |OPENSSH )?PRIVATE KEY|eyJ[A-Za-z0-9_-]{10,}|ssh |hypervisor|vm start/i;

describe("Cyber range", () => {
  it("renders seeded cyber-range summary counts from the API", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    expect(
      within(page).getByRole("heading", { level: 1, name: "Cyber range" }),
    ).toBeInTheDocument();
    expect((await within(page).findAllByText("DEVELOPMENT / SEEDED")).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/Development seeded data/i).length).toBeGreaterThan(0);
    expect(within(page).queryByText(/^SIMULATED$/)).not.toBeInTheDocument();
    expect(within(page).getByText(/no aggregate security score/i)).toBeInTheDocument();
    expect(within(page).getByText(/Lab Bridge: not_connected/)).toBeInTheDocument();
    expect(within(page).getByText(/Last successful lab sync: Not recorded/)).toBeInTheDocument();
    expect(within(page).getByText(/Scenarios running: 0/)).toBeInTheDocument();
    expect(within(page).getByText(/Detection coverage: 12/)).toBeInTheDocument();
    expect(within(page).getAllByText("Expected systems").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("Active observed").length).toBeGreaterThan(0);
    expect(within(page).getByText("0 / 4")).toBeInTheDocument();
    expect(within(page).getByText("4 / 6")).toBeInTheDocument();
    expect(page.textContent ?? "").toMatch(/outbound-only/i);
    expect(page.textContent ?? "").toMatch(/MacBook/i);
    expect(page.textContent ?? "").toMatch(/Lenovo/i);
    expect(page.textContent ?? "").toMatch(/no public inbound/i);
    expect(page.textContent ?? "").not.toMatch(secretPattern);
    expect(within(page).queryByText("SCN-001")).not.toBeInTheDocument();
    expect(within(page).queryByText("RUN-014")).not.toBeInTheDocument();
    expect(within(page).queryByRole("button", { name: /start|stop|ssh|execute/i })).toBeNull();
  });

  it("shows the loading skeleton before the cyber-range response arrives", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/cyber-range")) return new Promise(() => undefined);
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.queryByText("LAB-GW-01")).not.toBeInTheDocument();
    expect(screen.queryByText("SCN-001")).not.toBeInTheDocument();
    expect(screen.queryByText("RUN-014")).not.toBeInTheDocument();
  });

  it("shows an error with retry and does not substitute fixture rows", async () => {
    let fail = true;
    installApiFetch((url) => {
      if (url.includes("/api/v1/cyber-range/summary")) {
        return fail ? jsonResponse({ message: "down" }, 500) : jsonResponse(cyberRangeSummary);
      }
      if (url.includes("/api/v1/cyber-range")) return jsonResponse(assetPage([]));
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    expect(await screen.findByRole("alert")).toHaveTextContent("Cyber range data unavailable");
    expect(screen.queryByText("RUN-014")).not.toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect((await screen.findAllByText("DEVELOPMENT / SEEDED")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Lab Bridge: not_connected/)).toBeInTheDocument();
    expect(screen.queryByText("RUN-014")).not.toBeInTheDocument();
  });

  it("renders five zones and systems as not_observed", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    for (const cidr of [
      "10.10.10.0/24",
      "10.10.20.0/24",
      "10.10.30.0/24",
      "10.10.40.0/24",
      "10.10.50.0/24",
    ]) {
      expect(await within(page).findAllByText(cidr)).not.toHaveLength(0);
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
    expect(within(page).getAllByText("Not observed").length).toBeGreaterThan(0);
    expect(within(page).getByTestId("range-context")).toHaveTextContent("not_observed");
    expect(within(page).getByTestId("range-context")).toHaveTextContent("not_connected");
    expect(within(page).getByTestId("range-relationships")).toHaveTextContent(
      "documented lab architecture",
    );
    expect(within(page).getByTestId("range-relationships")).toHaveTextContent(
      "do not represent live reachability",
    );
    expect(within(page).queryByText("Reporting")).not.toBeInTheDocument();
  });

  it("maps system filters to supported API parameters", async () => {
    const { calls } = installApiFetch();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    await within(page).findAllByText("LAB-GW-01");
    const user = userEvent.setup();
    await user.selectOptions(within(page).getByLabelText("Zone"), "MGMT");
    await user.selectOptions(within(page).getByLabelText("Telemetry status"), "not_connected");
    expect(
      calls.some(
        (url) =>
          url.includes("/api/v1/cyber-range/systems") &&
          url.includes("zone=MGMT") &&
          url.includes("telemetry_status=not_connected"),
      ),
    ).toBe(true);
  });

  it("renders scenarios with zero running and null last runs", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    await user.click(await within(page).findByRole("tab", { name: "Scenarios" }));
    const scenarios = within(page).getByTestId("range-scenarios");
    expect(scenarios).toHaveTextContent("SCN-0001");
    expect(scenarios).toHaveTextContent("SCN-0006");
    expect(scenarios).not.toHaveTextContent("SCN-001");
    expect(scenarios).toHaveTextContent("Not run");
    expect(within(page).getByText(/Running scenarios: 0/)).toBeInTheDocument();
    expect(within(page).getByTestId("scenario-detail")).toHaveTextContent("Not run");
    expect(within(page).getByTestId("scenario-detail")).toHaveTextContent(
      "No execute, start, or stop action",
    );
  });

  it("maps scenario filters to supported API parameters", async () => {
    const { calls } = installApiFetch();
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    await user.click(await within(page).findByRole("tab", { name: "Scenarios" }));
    await user.selectOptions(within(page).getByLabelText("Status"), "ready");
    await user.selectOptions(within(page).getByLabelText("ATT&CK technique"), "T1059.001");
    expect(
      calls.some(
        (url) =>
          url.includes("/api/v1/cyber-range/scenarios") &&
          url.includes("status=ready") &&
          url.includes("attack_technique=T1059.001"),
      ),
    ).toBe(true);
  });

  it("renders telemetry as not_connected and detections as not_validated", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");

    await user.click(await within(page).findByRole("tab", { name: "Telemetry" }));
    const telemetry = within(page).getByTestId("range-telemetry");
    expect(telemetry).toHaveTextContent("not_connected");
    expect(telemetry).toHaveTextContent("Not connected");
    expect(telemetry).toHaveTextContent("Not recorded");
    expect(telemetry).toHaveTextContent("Wazuh and Suricata remain not_connected");

    await user.click(within(page).getByRole("tab", { name: "Detections" }));
    const detections = within(page).getByTestId("range-detections");
    for (let index = 1; index <= 12; index += 1) {
      expect(detections).toHaveTextContent(`DET-${String(index).padStart(4, "0")}`);
    }
    expect(detections).toHaveTextContent("not_validated");
    expect(detections).toHaveTextContent("Not validated");
    expect(detections).toHaveTextContent("not_connected");
    expect(detections.textContent ?? "").not.toMatch(/\bDET-001\b/);
  });

  it("maps detection filters to supported API parameters", async () => {
    const { calls } = installApiFetch();
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    await user.click(await within(page).findByRole("tab", { name: "Detections" }));
    await user.selectOptions(within(page).getByLabelText("Validation state"), "not_validated");
    await user.selectOptions(within(page).getByLabelText("Data source"), "Sysmon");
    expect(
      calls.some(
        (url) =>
          url.includes("/api/v1/cyber-range/detections") &&
          url.includes("validation_state=not_validated") &&
          url.includes("data_source=Sysmon"),
      ),
    ).toBe(true);
  });

  it("shows empty states when no cyber-range rows are stored", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/cyber-range/summary")) return jsonResponse(emptyCyberRangeSummary);
      if (url.includes("/api/v1/cyber-range")) return jsonResponse(assetPage([]));
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    expect(await within(page).findByText(/Lab Bridge: not_connected/)).toBeInTheDocument();
    expect(within(page).queryByText("LAB-GW-01")).not.toBeInTheDocument();
    expect(within(page).queryByText("RUN-014")).not.toBeInTheDocument();
    expect(within(page).getByText("No catalog relationships are stored.")).toBeInTheDocument();
    expect(within(page).queryByTestId("catalog-edge-list")).not.toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Segments" }));
    expect(within(page).getByText("No zones are stored.")).toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Scenarios" }));
    expect(within(page).getByTestId("range-scenarios")).toHaveTextContent(
      "No scenarios are stored.",
    );

    await user.click(within(page).getByRole("tab", { name: "Detections" }));
    expect(within(page).getByTestId("range-detections")).toHaveTextContent(
      "No detections are stored.",
    );
  });

  it("does not fall back to the old cyber-range fixture catalog", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    expect((await within(page).findAllByText("LAB-GW-01")).length).toBeGreaterThan(0);
    expect(within(page).queryByRole("tab", { name: "Runs" })).not.toBeInTheDocument();
    await user.click(within(page).getByRole("tab", { name: "Scenarios" }));
    expect(within(page).getByTestId("range-scenarios")).toHaveTextContent("SCN-0001");
    expect(within(page).queryByText("SCN-001")).not.toBeInTheDocument();
    expect(within(page).queryByText("RUN-014")).not.toBeInTheDocument();
    expect(within(page).queryByText("RUN-011")).not.toBeInTheDocument();
  });

  it("highlights only explicit catalog relationships for the selected system", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    await within(page).findAllByText("LAB-GW-01");

    const wazuh = within(page).getAllByRole("button", { name: /SEC-WAZUH-01/ })[0];
    await user.click(wazuh);

    expect(wazuh).toHaveAttribute("aria-pressed", "true");
    expect(wazuh).toHaveAttribute("data-catalog-relation", "selected");
    expect(wazuh).toHaveTextContent("Selected");
    expect(within(page).getAllByRole("button", { name: /WIN-USER-01/ })[0]).toHaveAttribute(
      "data-catalog-relation",
      "related",
    );
    expect(within(page).getAllByRole("button", { name: /WIN-USER-01/ })[0]).toHaveTextContent(
      "Catalog link",
    );
    expect(within(page).getAllByRole("button", { name: /LINUX-APP-01/ })[0]).toHaveAttribute(
      "data-catalog-relation",
      "related",
    );
    expect(within(page).getAllByRole("button", { name: /KALI-RED-01/ })[0]).toHaveAttribute(
      "data-catalog-relation",
      "unrelated",
    );
    expect(within(page).getAllByRole("button", { name: /LAB-GW-01/ })[0]).toHaveAttribute(
      "data-catalog-relation",
      "unrelated",
    );
    expect(within(page).getAllByRole("button", { name: /KALI-RED-01/ })[0]).not.toHaveTextContent(
      "Catalog link",
    );

    const list = within(page).getByTestId("catalog-relationship-list");
    expect(list).toHaveTextContent("Monitors → WIN-USER-01");
    expect(list).toHaveTextContent("Monitors → LINUX-APP-01");
    expect(list).toHaveTextContent("Dependency of ← WIN-USER-01");
    expect(list).not.toHaveTextContent("KALI-RED-01");
    expect(list).not.toHaveTextContent("LAB-GW-01");

    const edgeList = within(page).getByTestId("catalog-edge-list");
    expect(edgeList).toHaveTextContent("Monitors: SEC-WAZUH-01 → WIN-USER-01");
    expect(edgeList).toHaveTextContent("Monitors: SEC-WAZUH-01 → LINUX-APP-01");
    expect(edgeList).toHaveTextContent("Depends on: WIN-USER-01 → SEC-WAZUH-01");
    expect(edgeList).not.toHaveTextContent("LAB-GW-01");
    expect(edgeList).not.toHaveTextContent("KALI-RED-01");
    const lines = page.querySelectorAll("[data-relationship-id]");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toHaveAttribute("marker-end");
    expect(page.querySelector("[data-relationship-id='REL-0002']")).toHaveAttribute(
      "data-edge-emphasis",
      "direct",
    );
    expect(page.querySelector("[data-relationship-kind='attack_path']")).toBeNull();
    expect(page.querySelector(".catalog-edge-layer")).toHaveAttribute("aria-hidden", "true");
  });

  it("selects a lab system from the keyboard and keeps the catalog highlight", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    await within(page).findAllByText("LAB-GW-01");

    const app = within(page).getAllByRole("button", { name: /LINUX-APP-01/ })[0];
    app.focus();
    await user.keyboard("{Enter}");

    expect(app).toHaveFocus();
    expect(app).toHaveAttribute("aria-pressed", "true");
    expect(within(page).getAllByRole("button", { name: /SEC-WAZUH-01/ })[0]).toHaveAttribute(
      "data-catalog-relation",
      "related",
    );
    expect(within(page).getByTestId("catalog-relationship-list")).toHaveTextContent(
      "Monitored by ← SEC-WAZUH-01",
    );
    expect(page.querySelector("[data-relationship-id='REL-0002']")).toHaveAttribute(
      "data-edge-emphasis",
      "direct",
    );
    expect(page.querySelector("[data-relationship-id='REL-0001']")).toHaveAttribute(
      "data-edge-emphasis",
      "baseline",
    );
    expect(page.querySelector("[data-relationship-id='REL-0003']")).toHaveAttribute(
      "data-edge-emphasis",
      "baseline",
    );
  });

  it("keeps catalog highlight without a motion transform when reduced motion is requested", async () => {
    document.documentElement.dataset.motion = "reduce";
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    await within(page).findAllByText("LAB-GW-01");
    const wazuh = within(page).getAllByRole("button", { name: /SEC-WAZUH-01/ })[0];
    await user.click(wazuh);

    expect(wazuh).toHaveAttribute("data-catalog-relation", "selected");
    expect(wazuh.className).toContain("motion-catalog-state");
    expect(wazuh.className).not.toContain("translate");
    expect(within(page).getAllByRole("button", { name: /WIN-USER-01/ })[0]).toHaveTextContent(
      "Catalog link",
    );

    const rule = motionCss.slice(
      motionCss.indexOf(".motion-catalog-state {"),
      motionCss.indexOf('.motion-catalog-state[data-catalog-relation="selected"]'),
    );
    expect(rule).toContain(
      "transition-property: border-color, background-color, opacity, box-shadow",
    );
    expect(rule).not.toContain("transform");
    const edgeRule = motionCss.slice(
      motionCss.indexOf(".catalog-edge {"),
      motionCss.indexOf('.catalog-edge[data-edge-emphasis="direct"]'),
    );
    expect(edgeRule).toContain("transition-property: opacity, stroke-width");
    expect(edgeRule).not.toContain("transform");
    expect(edgeRule).not.toContain("stroke-dasharray");
    expect(edgeRule).not.toContain("animation");
    const reduced = motionCss.slice(motionCss.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain("transition-duration: 0.01ms !important");
    delete document.documentElement.dataset.motion;
  });

  it("does not infer second-degree, shared-zone, or unknown relationships", () => {
    const stored = [
      edge("REL-0001", "SEC-WAZUH-01", "WIN-USER-01", "monitors"),
      edge("REL-0002", "SEC-WAZUH-01", "LINUX-APP-01", "monitors"),
      edge("REL-0003", "WIN-USER-01", "SEC-WAZUH-01", "depends_on"),
      edge("REL-0004", "LINUX-APP-01", "KALI-RED-01", "depends_on"),
    ];
    expect(directCatalogPeerIds("SEC-WAZUH-01", stored)).toEqual(
      new Set(["WIN-USER-01", "LINUX-APP-01"]),
    );
    expect(directCatalogPeerIds("WIN-USER-01", stored.slice(0, 3))).toEqual(
      new Set(["SEC-WAZUH-01"]),
    );
    expect(directCatalogPeerIds("LAB-GW-01", stored).size).toBe(0);
    expect(
      mapLabSystemRelationship({
        id: "REL-0099",
        source_system_id: "LAB-GW-01",
        target_system_id: "LAB-GW-01",
        relationship_kind: "connected_to",
      }),
    ).toBeNull();
    expect(
      mapLabSystemRelationship({
        id: "REL-0098",
        source_system_id: "KALI-RED-01",
        target_system_id: "WIN-USER-01",
        relationship_kind: "attack_path",
      }),
    ).toBeNull();
    expect(
      catalogRelationState("WIN-USER-01", "SEC-WAZUH-01", new Set(["WIN-USER-01"]), true),
    ).toBe("related");
    const statements = catalogRelationshipStatements(
      "SEC-WAZUH-01",
      stored.slice(0, 3),
      new Map([
        ["WIN-USER-01", "WIN-USER-01"],
        ["LINUX-APP-01", "LINUX-APP-01"],
      ]),
    );
    expect(statements.map((item) => item.otherSystemId)).toEqual([
      "WIN-USER-01",
      "LINUX-APP-01",
      "WIN-USER-01",
    ]);
    expect(catalogEdgeShowsArrow("monitors")).toBe(true);
    expect(catalogEdgeShowsArrow("connected_to")).toBe(false);
    expect(catalogEdgeTouchesSelection(stored[1], "LINUX-APP-01")).toBe(true);
    expect(catalogEdgeTouchesSelection(stored[0], "LINUX-APP-01")).toBe(false);
    expect(
      catalogEdgeCaption(
        stored[0],
        new Map([
          ["SEC-WAZUH-01", "SEC-WAZUH-01"],
          ["WIN-USER-01", "WIN-USER-01"],
        ]),
      ),
    ).toBe("Monitors: SEC-WAZUH-01 → WIN-USER-01");
    const right = anchorOnBox({ left: 0, top: 0, width: 20, height: 10 }, { x: 40, y: 5 });
    expect(right).toEqual({ x: 20, y: 5 });
    expect(offsetsForBundle(2)).toEqual([-4, 4]);
    const forward = stableOffset("AAA", "BBB", { x: 0, y: 0 }, { x: 10, y: 0 }, 8);
    const reverse = stableOffset("BBB", "AAA", { x: 10, y: 0 }, { x: 0, y: 0 }, -8);
    expect(forward).toEqual({ x: 0, y: 8 });
    expect(reverse).toEqual({ x: 0, y: -8 });
  });
});

function edge(
  id: string,
  sourceSystemId: string,
  targetSystemId: string,
  kind: LabSystemRelationshipView["kind"],
): LabSystemRelationshipView {
  return { id, sourceSystemId, targetSystemId, kind };
}
