import { screen, within } from "@testing-library/react";
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

async function openPolicies(user: ReturnType<typeof userEvent.setup>) {
  await renderWithProviders(<AppRouter />, { initialEntries: ["/governance"] });
  const page = screen.getByTestId("governance-page");
  await user.click(await within(page).findByRole("tab", { name: "Policies" }));
  expect(await within(page).findByTestId("policy-management-panel")).toBeInTheDocument();
  return page;
}

describe("Policy ↔ control mapping UI", () => {
  it("shows empty mapped controls and mapped policies states", async () => {
    installApiFetch();
    const user = userEvent.setup();
    const page = await openPolicies(user);

    expect(await screen.findByTestId("policy-mappings-empty")).toHaveTextContent(
      /No controls are mapped/i,
    );
    expect(screen.getByTestId("policy-control-mappings").textContent).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-/i,
    );
    // Must not surface licensed CIS safeguard body text (disclaimer wording is OK).
    expect(screen.getByTestId("policy-control-mappings").textContent?.toLowerCase()).not.toMatch(
      /establish and maintain|inventory of enterprise assets/i,
    );

    await user.click(within(page).getByRole("tab", { name: "Controls" }));
    expect(await screen.findByTestId("control-mapped-policies-empty")).toHaveTextContent(
      /No policies are mapped/i,
    );
  });

  it("links and unlinks with CSRF, human ids, and no body for policy.manage", async () => {
    setCsrfToken("map-csrf");
    const { calls, inits } = installApiFetch();
    const user = userEvent.setup();
    await openPolicies(user);

    expect(screen.getByTestId("policy-mapping-add")).toBeInTheDocument();
    await user.click(screen.getByTestId("policy-mapping-add"));
    expect(await screen.findByTestId("policy-mapping-control-select")).toBeInTheDocument();
    await user.click(await screen.findByTestId("policy-mapping-control-option-CTRL-0002"));
    await user.click(screen.getByTestId("policy-mapping-link-submit"));

    expect(await screen.findByTestId("policy-mapping-success")).toHaveTextContent(/CTRL-0002/);
    expect(await screen.findByTestId("policy-mapping-CTRL-0002")).toHaveTextContent("AC-2");
    expect(screen.getByTestId("policy-mapping-CTRL-0002")).toHaveTextContent("NIST-800-53");
    expect(screen.getByTestId("policy-mapping-CTRL-0002")).toHaveTextContent(
      "licensed_text_included=false",
    );
    expect(screen.queryByTestId("policy-mappings-empty")).not.toBeInTheDocument();

    const linkIndex = calls.findIndex(
      (url, index) =>
        url.endsWith("/api/v1/policies/POL-0001/controls/CTRL-0002") &&
        inits[index]?.method === "POST",
    );
    expect(linkIndex).toBeGreaterThanOrEqual(0);
    expect(inits[linkIndex]?.body).toBeUndefined();
    expect((inits[linkIndex]?.headers as Headers).get("X-CSRF-Token")).toBe("map-csrf");
    expect(inits[linkIndex]?.credentials).toBe("include");
    expect(getCsrfToken()).toBe("map-csrf");
    expect(window.localStorage.length).toBe(0);

    // Idempotent second link does not duplicate rows
    await user.click(screen.getByTestId("policy-mapping-add"));
    const option = await screen.findByTestId("policy-mapping-control-option-CTRL-0002");
    expect(option).toBeDisabled();

    await user.click(screen.getByTestId("policy-mapping-unlink-CTRL-0002"));
    expect(await screen.findByTestId("policy-mapping-unlink-confirm")).toHaveTextContent(
      /policy remains/i,
    );
    expect(screen.getByTestId("policy-mapping-unlink-confirm")).toHaveTextContent(
      /Only the relationship is removed/i,
    );
    await user.click(screen.getByTestId("policy-mapping-unlink-confirm-submit"));
    expect(await screen.findByTestId("policy-mappings-empty")).toBeInTheDocument();

    const unlinkIndex = calls.findIndex(
      (url, index) =>
        url.endsWith("/api/v1/policies/POL-0001/controls/CTRL-0002") &&
        inits[index]?.method === "DELETE",
    );
    expect(unlinkIndex).toBeGreaterThanOrEqual(0);
    expect(inits[unlinkIndex]?.body).toBeUndefined();
    expect((inits[unlinkIndex]?.headers as Headers).get("X-CSRF-Token")).toBe("map-csrf");
  });

  it("shows mapped policy on control detail after link and navigates Open control", async () => {
    setCsrfToken("map-csrf");
    installApiFetch();
    const user = userEvent.setup();
    const page = await openPolicies(user);

    await user.click(screen.getByTestId("policy-mapping-add"));
    await user.click(await screen.findByTestId("policy-mapping-control-option-CTRL-0002"));
    await user.click(screen.getByTestId("policy-mapping-link-submit"));
    expect(await screen.findByTestId("policy-mapping-CTRL-0002")).toBeInTheDocument();

    await user.click(screen.getByTestId("policy-mapping-open-CTRL-0002"));
    expect(await screen.findByTestId("control-mapped-policy-POL-0001")).toHaveTextContent(
      "Access control policy",
    );
    expect(screen.getByTestId("control-mapped-policies").textContent).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-/i,
    );
    expect(within(page).getByTestId("governance-control-CTRL-0002")).toBeInTheDocument();
  });

  it("hides link/unlink for users without policy.manage", async () => {
    const readOnly = {
      ...currentUserFixture,
      permissions: ["control.read", "policy.read", "evidence.read"],
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
    const user = userEvent.setup();
    await openPolicies(user);
    expect(screen.getByTestId("policy-mapping-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("policy-mapping-add")).not.toBeInTheDocument();
  });

  it("does not infer mapping manage from Administrator role name", async () => {
    const labeledAdmin = {
      ...currentUserFixture,
      roles: ["Administrator"],
      permissions: ["control.read", "policy.read"],
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
    const user = userEvent.setup();
    await openPolicies(user);
    expect(screen.getByTestId("policy-mapping-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("policy-mapping-add")).not.toBeInTheDocument();
  });

  it("handles missing mapping 404 on unlink with refetch", async () => {
    setCsrfToken("map-csrf");
    let unlinkCalls = 0;
    installApiFetch((url, init) => {
      if (
        url.endsWith("/api/v1/policies/POL-0001/controls/CTRL-0002") &&
        init?.method === "DELETE"
      ) {
        unlinkCalls += 1;
        if (unlinkCalls === 1) {
          return jsonResponse(
            { code: "not_found", message: "Control is not linked to this policy." },
            404,
          );
        }
      }
      return undefined;
    });
    const user = userEvent.setup();
    await openPolicies(user);
    await user.click(screen.getByTestId("policy-mapping-add"));
    await user.click(await screen.findByTestId("policy-mapping-control-option-CTRL-0002"));
    await user.click(screen.getByTestId("policy-mapping-link-submit"));
    expect(await screen.findByTestId("policy-mapping-CTRL-0002")).toBeInTheDocument();

    // Force fixture unlink map empty by deleting via override first response
    await user.click(screen.getByTestId("policy-mapping-unlink-CTRL-0002"));
    await user.click(screen.getByTestId("policy-mapping-unlink-confirm-submit"));
    expect(await screen.findByTestId("policy-mapping-error")).toHaveTextContent(
      /not found|no longer/i,
    );
  });
});
