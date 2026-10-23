import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { getCsrfToken, setCsrfToken } from "@/services/csrf";
import {
  authenticatedSessionFixture,
  currentUserFixture,
  installApiFetch,
  jsonResponse,
} from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

async function openRisks() {
  await renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
  const page = screen.getByTestId("risks-page");
  expect(await within(page).findByTestId("risk-control-mappings-empty")).toBeInTheDocument();
  return page;
}

describe("Risk ↔ control mapping UI", () => {
  it("shows empty mapped controls, semantics, and no licensed text", async () => {
    installApiFetch();
    const page = await openRisks();
    expect(within(page).getByTestId("risk-control-mappings-empty")).toHaveTextContent(
      "No controls are mapped to this risk yet.",
    );
    expect(within(page).getByTestId("risk-control-mapping-semantics")).toHaveTextContent(
      "Mapping a control to a risk does not change the risk score or prove the control is effective.",
    );
    expect(within(page).getByTestId("risk-control-mapping-semantics").textContent).not.toMatch(
      /CIS Control \d/i,
    );
    expect(page.textContent).not.toMatch(UUID_RE);
    expect(page.textContent).not.toMatch(/risk reduced/i);
    expect(page.textContent).not.toMatch(/risk mitigated/i);
  });

  it("links and unlinks with CSRF, human ids, and no body for risk.manage", async () => {
    setCsrfToken("map-csrf");
    const { calls, inits } = installApiFetch();
    const user = userEvent.setup();
    const page = await openRisks();

    expect(screen.getByTestId("treatment-status")).toHaveValue("planned");
    expect(within(page).getAllByText(/Score\s*20/).length).toBeGreaterThan(0);

    await user.click(screen.getByTestId("risk-control-mapping-add"));
    expect(await screen.findByTestId("risk-control-mapping-control-select")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        calls.some(
          (url) =>
            url.includes("/api/v1/governance/controls?") &&
            url.includes("page=1") &&
            url.includes("page_size=20"),
        ),
      ).toBe(true);
    });
    await user.click(screen.getByTestId("risk-control-mapping-catalog-pager-next"));
    await waitFor(() => {
      expect(
        calls.some(
          (url) =>
            url.includes("/api/v1/governance/controls?") &&
            url.includes("page=2") &&
            url.includes("page_size=20"),
        ),
      ).toBe(true);
    });
    await user.click(screen.getByTestId("risk-control-mapping-catalog-pager-previous"));
    await user.type(screen.getByTestId("risk-control-mapping-control-filter"), "CTRL-0002");
    await waitFor(() => {
      expect(
        calls.some(
          (url) => url.includes("/api/v1/governance/controls?") && url.includes("q=CTRL-0002"),
        ),
      ).toBe(true);
    });
    await user.click(await screen.findByTestId("risk-control-mapping-control-option-CTRL-0002"));
    await user.click(screen.getByTestId("risk-control-mapping-link-submit"));

    const mapped = await screen.findByTestId("risk-control-mapping-CTRL-0002");
    expect(mapped).toHaveTextContent("AC-2");
    expect(mapped).toHaveTextContent("NIST-800-53");
    expect(mapped).toHaveTextContent("Rev. 5");
    expect(mapped).toHaveTextContent("Account Management");
    expect(mapped).toHaveTextContent("partial");
    expect(mapped).toHaveTextContent("licensed_text_included=false");
    expect(screen.getAllByTestId("risk-control-mapping-CTRL-0002")).toHaveLength(1);
    expect(mapped.textContent).not.toMatch(UUID_RE);
    expect(mapped.textContent).not.toMatch(/safeguard/i);
    expect(screen.getByTestId("treatment-status")).toHaveValue("planned");
    expect(within(page).getAllByText(/Score\s*20/).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/Inherent likelihood\s*4/i).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/Inherent impact\s*5/i).length).toBeGreaterThan(0);

    const linkIndex = calls.findIndex(
      (url, index) =>
        url.endsWith("/api/v1/risks/RISK-0021/controls/CTRL-0002") &&
        inits[index]?.method === "POST",
    );
    expect(linkIndex).toBeGreaterThanOrEqual(0);
    expect(inits[linkIndex]?.body).toBeUndefined();
    expect((inits[linkIndex]?.headers as Headers).get("X-CSRF-Token")).toBe("map-csrf");
    expect(inits[linkIndex]?.credentials).toBe("include");
    expect(getCsrfToken()).toBe("map-csrf");
    expect(window.localStorage.length).toBe(0);

    await user.click(screen.getByTestId("risk-control-mapping-add"));
    const option = await screen.findByTestId("risk-control-mapping-control-option-CTRL-0002");
    expect(option).toBeDisabled();
    expect(screen.getAllByTestId("risk-control-mapping-CTRL-0002")).toHaveLength(1);

    await user.click(screen.getByTestId("risk-control-mapping-open-CTRL-0002"));
    const controlRisk = await screen.findByTestId("control-mapped-risk-RISK-0021");
    expect(controlRisk).toHaveTextContent("Service exploitation on the finance application");
    expect(controlRisk).toHaveTextContent("Likelihood 4");
    expect(controlRisk).toHaveTextContent("Impact 5");
    expect(controlRisk).toHaveTextContent("Score 20");
    expect(controlRisk).toHaveTextContent("Treatment planned");
    expect(screen.getByTestId("control-mapped-risks").textContent).not.toMatch(/residual/i);
    expect(screen.getByTestId("control-mapped-risks").textContent).not.toMatch(/effectiveness/i);
    expect(screen.getByTestId("control-mapped-risks").textContent).not.toMatch(UUID_RE);
    expect(screen.getByTestId("control-evidence-row-EVID-0041")).toHaveTextContent(
      "Privileged account export note",
    );
    expect(screen.getByText("No control tests recorded for this control.")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Risk Management" }));
    expect(await screen.findByTestId("risk-control-mapping-CTRL-0002")).toBeInTheDocument();
    await user.click(screen.getByTestId("risk-control-mapping-unlink-CTRL-0002"));
    const confirm = await screen.findByTestId("risk-control-mapping-unlink-confirm");
    expect(confirm).toHaveTextContent("Remove this control mapping?");
    expect(confirm).toHaveTextContent(
      "This removes only the relationship. The risk, control, tests, evidence, and treatment data remain unchanged.",
    );
    await user.click(screen.getByTestId("risk-control-mapping-unlink-confirm-submit"));
    expect(await screen.findByTestId("risk-control-mappings-empty")).toBeInTheDocument();
    expect(screen.getAllByText(/RISK-0021/).length).toBeGreaterThan(0);
    expect(screen.getByTestId("treatment-status")).toHaveValue("planned");
    expect(screen.getAllByText(/Score\s*20/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("link", { name: "Governance & Compliance" }));
    const governance = screen.getByTestId("governance-page");
    await user.click(await within(governance).findByRole("tab", { name: "Controls" }));
    expect(await screen.findByTestId("governance-control-CTRL-0002")).toBeInTheDocument();
    await user.click(screen.getByTestId("governance-control-CTRL-0002"));
    expect(await screen.findByTestId("control-mapped-risks-empty")).toBeInTheDocument();
    expect(screen.getByTestId("control-evidence-row-EVID-0041")).toBeInTheDocument();

    const unlinkIndex = calls.findIndex(
      (url, index) =>
        url.endsWith("/api/v1/risks/RISK-0021/controls/CTRL-0002") &&
        inits[index]?.method === "DELETE",
    );
    expect(unlinkIndex).toBeGreaterThanOrEqual(0);
    expect(inits[unlinkIndex]?.body).toBeUndefined();
    expect((inits[unlinkIndex]?.headers as Headers).get("X-CSRF-Token")).toBe("map-csrf");
  });

  it("hides link and remove for users without risk.manage", async () => {
    const readOnly = {
      ...currentUserFixture,
      roles: ["Read Only"],
      permissions: ["risk.read", "control.read"],
    };
    installApiFetch(
      (url) => {
        if (url.includes("/api/v1/auth/session")) {
          return jsonResponse({ ...authenticatedSessionFixture, user: readOnly });
        }
        if (url.includes("/api/v1/auth/me")) {
          return jsonResponse(readOnly);
        }
        return undefined;
      },
      { authenticated: true, allowAuthOverride: true },
    );
    await openRisks();
    expect(screen.getByTestId("risk-control-mapping-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("risk-control-mapping-add")).not.toBeInTheDocument();
    expect(screen.queryByTestId("risk-control-mapping-unlink-CTRL-0002")).not.toBeInTheDocument();
  });

  it("does not infer mapping manage from an Administrator role name", async () => {
    const labeledAdmin = {
      ...currentUserFixture,
      roles: ["Administrator"],
      permissions: ["risk.read", "control.read"],
    };
    installApiFetch(
      (url) => {
        if (url.includes("/api/v1/auth/session")) {
          return jsonResponse({ ...authenticatedSessionFixture, user: labeledAdmin });
        }
        if (url.includes("/api/v1/auth/me")) {
          return jsonResponse(labeledAdmin);
        }
        return undefined;
      },
      { authenticated: true, allowAuthOverride: true },
    );
    await openRisks();
    expect(screen.getByTestId("risk-control-mapping-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("risk-control-mapping-add")).not.toBeInTheDocument();
  });

  it("refetches when unlink returns 404", async () => {
    setCsrfToken("map-csrf");
    let unlinkCalls = 0;
    installApiFetch((url, init) => {
      if (url.endsWith("/api/v1/risks/RISK-0021/controls/CTRL-0002") && init?.method === "DELETE") {
        unlinkCalls += 1;
        if (unlinkCalls === 1) {
          return jsonResponse(
            { code: "not_found", message: "Control is not linked to this risk." },
            404,
          );
        }
      }
      return undefined;
    });
    const user = userEvent.setup();
    await openRisks();
    await user.click(screen.getByTestId("risk-control-mapping-add"));
    await user.click(await screen.findByTestId("risk-control-mapping-control-option-CTRL-0002"));
    await user.click(screen.getByTestId("risk-control-mapping-link-submit"));
    expect(await screen.findByTestId("risk-control-mapping-CTRL-0002")).toBeInTheDocument();
    await user.click(screen.getByTestId("risk-control-mapping-unlink-CTRL-0002"));
    await user.click(screen.getByTestId("risk-control-mapping-unlink-confirm-submit"));
    expect(await screen.findByTestId("risk-control-mapping-error")).toHaveTextContent(/not found/i);
    expect(screen.getByTestId("risk-control-mapping-CTRL-0002")).toBeInTheDocument();
  });
});

describe("Control detail mapped risks", () => {
  it("shows an empty mapped-risk state without invented metrics", async () => {
    installApiFetch();
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/governance"] });
    const page = screen.getByTestId("governance-page");
    await user.click(await within(page).findByRole("tab", { name: "Controls" }));
    await user.click(await screen.findByTestId("governance-control-CTRL-0002"));
    expect(await screen.findByTestId("control-mapped-risks-empty")).toHaveTextContent(
      "No risks are mapped to this control.",
    );
    expect(screen.getByTestId("control-mapped-risks").textContent).not.toMatch(/residual/i);
    expect(screen.getByTestId("control-mapped-risks").textContent).not.toMatch(
      /effectiveness score/i,
    );
    expect(screen.getByTestId("control-mapped-risks")).toHaveTextContent(
      "does not change the risk score or prove the control is effective",
    );
  });
});
