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

describe("Policy management UI", () => {
  it("loads policy list/detail and marks published history immutable", async () => {
    installApiFetch();
    const user = userEvent.setup();
    const page = await openPolicies(user);

    expect(await within(page).findByTestId("policy-select-POL-0001")).toBeInTheDocument();
    expect(await screen.findByTestId("policy-detail")).toBeInTheDocument();
    expect(screen.getByTestId("policy-current-version")).toHaveTextContent("1.0");
    expect(screen.getByTestId("policies-list")).toHaveTextContent("POL-0001");
    expect(screen.getByTestId("policy-version-history")).toHaveTextContent("1.0");
    expect(await screen.findByTestId("policy-version-readonly")).toHaveTextContent(
      /cannot be edited/i,
    );
    expect(screen.queryByTestId("policy-version-save")).not.toBeInTheDocument();
    expect(screen.getByTestId("policy-ack-summary").textContent).not.toMatch(/completion %|100%/i);
  });

  it("creates a policy with CSRF and explicit payload for policy.manage", async () => {
    setCsrfToken("policy-csrf");
    const { calls, inits } = installApiFetch();
    const user = userEvent.setup();
    await openPolicies(user);

    expect(screen.getByTestId("policy-create-form")).toBeInTheDocument();
    await user.clear(screen.getByTestId("policy-create-title"));
    await user.type(screen.getByTestId("policy-create-title"), "Acceptable use");
    await user.clear(screen.getByTestId("policy-create-content"));
    await user.type(screen.getByTestId("policy-create-content"), "AUP draft body.");
    await user.click(screen.getByTestId("policy-create"));

    expect(await screen.findByTestId("policy-success")).toHaveTextContent(/POL-0002/);
    const createIndex = calls.findIndex(
      (url, index) => url.endsWith("/api/v1/policies") && inits[index]?.method === "POST",
    );
    expect(createIndex).toBeGreaterThanOrEqual(0);
    const body = JSON.parse(String(inits[createIndex]?.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      ["initial_content", "initial_version_label", "title"].sort(),
    );
    expect(body).not.toHaveProperty("human_id");
    expect(body).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("permissions");
    expect((inits[createIndex]?.headers as Headers).get("X-CSRF-Token")).toBe("policy-csrf");
    expect(inits[createIndex]?.credentials).toBe("include");
    expect(getCsrfToken()).toBe("policy-csrf");
    expect(window.localStorage.length).toBe(0);
  });

  it("hides create for users without policy.manage", async () => {
    const readOnly = {
      ...currentUserFixture,
      permissions: ["control.read", "policy.read"],
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
    expect(screen.getByTestId("policy-create-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("policy-create")).not.toBeInTheDocument();
    expect(screen.queryByTestId("policy-transition-approved")).not.toBeInTheDocument();
    expect(screen.queryByTestId("policy-transition-published")).not.toBeInTheDocument();
  });

  it("shows approve/publish for approve-only users without manage create", async () => {
    const approver = {
      ...currentUserFixture,
      roles: ["CISO"],
      permissions: ["control.read", "policy.read", "policy.approve"],
    };
    installApiFetch(
      (url) => {
        if (url.includes("/api/v1/auth/session")) {
          return jsonResponse({ ...authenticatedSessionFixture, user: approver });
        }
        if (url.includes("/api/v1/auth/me")) {
          return jsonResponse(approver);
        }
        return undefined;
      },
      { authenticated: true, allowAuthOverride: true },
    );
    setCsrfToken("policy-csrf");
    const user = userEvent.setup();
    await openPolicies(user);
    expect(screen.getByTestId("policy-create-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("policy-create")).not.toBeInTheDocument();
    // Seeded POL-0001 is published → retire available to approve
    expect(await screen.findByTestId("policy-transition-retired")).toBeInTheDocument();
  });

  it("edits drafts, blocks published edits, and handles 409", async () => {
    setCsrfToken("policy-csrf");
    let draftPatches = 0;
    const { calls, inits } = installApiFetch((url, init) => {
      if (url.includes("/api/v1/policies/POL-0002/versions/0.1") && init?.method === "PATCH") {
        draftPatches += 1;
        if (draftPatches >= 2) {
          return jsonResponse(
            { code: "conflict", message: "The policy version was modified by another request." },
            409,
          );
        }
      }
      return undefined;
    });
    const user = userEvent.setup();
    await openPolicies(user);

    await user.type(screen.getByTestId("policy-create-title"), "Lifecycle policy");
    await user.click(screen.getByTestId("policy-create"));
    expect(await screen.findByTestId("policy-success")).toHaveTextContent(/POL-0002/);

    expect(await screen.findByTestId("policy-version-save")).toBeInTheDocument();
    await user.clear(screen.getByTestId("policy-version-content"));
    await user.type(screen.getByTestId("policy-version-content"), "Updated draft body.");
    await user.click(screen.getByTestId("policy-version-save"));
    expect(await screen.findByTestId("policy-success")).toHaveTextContent(/saved/i);

    const patchIndex = calls.findIndex(
      (url, index) =>
        url.includes("/api/v1/policies/POL-0002/versions/0.1") && inits[index]?.method === "PATCH",
    );
    expect(patchIndex).toBeGreaterThanOrEqual(0);
    expect((inits[patchIndex]?.headers as Headers).get("X-CSRF-Token")).toBe("policy-csrf");

    await user.type(screen.getByTestId("policy-version-content"), " more");
    await user.click(screen.getByTestId("policy-version-save"));
    expect(await screen.findByTestId("policy-conflict")).toHaveTextContent(
      /changed since you loaded it/i,
    );
    expect(screen.getByTestId("policy-reload")).toBeInTheDocument();
  });

  it("requires publish confirmation and keeps historical versions", async () => {
    setCsrfToken("policy-csrf");
    const { calls, inits } = installApiFetch();
    const user = userEvent.setup();
    await openPolicies(user);

    await user.type(screen.getByTestId("policy-create-title"), "Publishable");
    await user.click(screen.getByTestId("policy-create"));
    await screen.findByTestId("policy-success");

    await user.click(screen.getByTestId("policy-transition-in_review"));
    await screen.findByTestId("policy-success");
    await user.click(screen.getByTestId("policy-transition-approved"));
    await screen.findByTestId("policy-success");

    await user.click(screen.getByTestId("policy-transition-published"));
    expect(await screen.findByTestId("policy-publish-confirm")).toHaveTextContent(/immutable/i);
    await user.selectOptions(screen.getByTestId("policy-publish-version"), "0.1");
    await user.click(screen.getByTestId("policy-publish-confirm-submit"));
    expect(await screen.findByTestId("policy-success")).toHaveTextContent(/Published/i);
    expect(screen.getByTestId("policy-current-version")).toHaveTextContent("0.1");
    expect(screen.getByTestId("policy-version-readonly")).toBeInTheDocument();

    const transitionIndex = calls.findIndex(
      (url, index) =>
        url.includes("/api/v1/policies/POL-0002/transition") &&
        inits[index]?.method === "POST" &&
        String(inits[index]?.body).includes('"published"'),
    );
    expect(transitionIndex).toBeGreaterThanOrEqual(0);
    const body = JSON.parse(String(inits[transitionIndex]?.body)) as Record<string, unknown>;
    expect(body.to_status).toBe("published");
    expect(body.version_label).toBe("0.1");
    expect(body).not.toHaveProperty("permissions");

    await user.click(screen.getByTestId("policy-new-version"));
    await user.type(screen.getByTestId("policy-new-version-label"), "0.2");
    await user.type(screen.getByTestId("policy-new-version-content"), "Replacement draft.");
    await user.click(screen.getByTestId("policy-new-version-submit"));
    expect(await screen.findByTestId("policy-success")).toHaveTextContent(/0\.2/);
    expect(screen.getByTestId("policy-version-history")).toHaveTextContent("0.1");
    expect(screen.getByTestId("policy-version-history")).toHaveTextContent("0.2");
  });

  it("acknowledges current published version with CSRF and no other-user UI", async () => {
    setCsrfToken("policy-csrf");
    // Start from a fresh published policy created in fixture flow
    const { calls, inits } = installApiFetch();
    const user = userEvent.setup();
    await openPolicies(user);

    // POL-0001 already acknowledged by fixture admin; create+publish another
    await user.type(screen.getByTestId("policy-create-title"), "Ack policy");
    await user.click(screen.getByTestId("policy-create"));
    await screen.findByTestId("policy-success");
    await user.click(screen.getByTestId("policy-transition-in_review"));
    await screen.findByTestId("policy-success");
    await user.click(screen.getByTestId("policy-transition-approved"));
    await screen.findByTestId("policy-success");
    await user.click(screen.getByTestId("policy-transition-published"));
    await user.selectOptions(await screen.findByTestId("policy-publish-version"), "0.1");
    await user.click(screen.getByTestId("policy-publish-confirm-submit"));
    await screen.findByTestId("policy-success");

    expect(screen.queryByLabelText(/user/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("policy-acknowledge")).toBeInTheDocument();
    await user.click(screen.getByTestId("policy-acknowledge"));
    expect(await screen.findByTestId("policy-acknowledged-state")).toHaveTextContent(
      /Acknowledged/i,
    );
    expect(screen.queryByTestId("policy-acknowledge")).not.toBeInTheDocument();

    const ackCalls = calls
      .map((url, index) => ({ url, init: inits[index] }))
      .filter(
        ({ url, init }) =>
          url.includes("/api/v1/policies/POL-0002/acknowledge") && init?.method === "POST",
      );
    expect(ackCalls).toHaveLength(1);
    expect((ackCalls[0]?.init?.headers as Headers).get("X-CSRF-Token")).toBe("policy-csrf");
    expect(ackCalls[0]?.init?.body).toBeUndefined();
  });

  it("does not infer permissions from Administrator role name alone", async () => {
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
    expect(screen.getByTestId("policy-create-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("policy-create")).not.toBeInTheDocument();
    expect(screen.queryByTestId("policy-transition-retired")).not.toBeInTheDocument();
  });
});
