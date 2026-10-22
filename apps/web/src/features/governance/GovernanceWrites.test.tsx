import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { setCsrfToken } from "@/services/csrf";
import {
  authenticatedSessionFixture,
  controlDetailSeed,
  currentUserFixture,
  installApiFetch,
  jsonResponse,
} from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

async function openControls(user: ReturnType<typeof userEvent.setup>) {
  await renderWithProviders(<AppRouter />, { initialEntries: ["/governance"] });
  const page = screen.getByTestId("governance-page");
  await user.click(await within(page).findByRole("tab", { name: "Controls" }));
  expect(await within(page).findByTestId("governance-control-CTRL-0002")).toBeInTheDocument();
  return page;
}

describe("Governance write integration", () => {
  it("allows control.manage users to update implementation with CSRF and expected_updated_at", async () => {
    setCsrfToken("gov-csrf");
    const { calls, inits } = installApiFetch();
    const user = userEvent.setup();
    const page = await openControls(user);

    expect(await within(page).findByTestId("control-implementation-editor")).toBeInTheDocument();
    await user.selectOptions(screen.getByTestId("control-implementation-status"), "implemented");
    await user.clear(screen.getByTestId("control-implementation-notes"));
    await user.type(screen.getByTestId("control-implementation-notes"), "Lab implementation note.");
    await user.click(screen.getByTestId("control-implementation-save"));

    expect(await screen.findByTestId("control-implementation-success")).toHaveTextContent(
      "Control implementation updated",
    );
    const patchIndex = calls.findIndex(
      (url, index) =>
        url.includes("/api/v1/governance/controls/CTRL-0002/implementation") &&
        inits[index]?.method === "PATCH",
    );
    expect(patchIndex).toBeGreaterThanOrEqual(0);
    const body = JSON.parse(String(inits[patchIndex]?.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["expected_updated_at", "notes", "status"].sort());
    expect(body.status).toBe("implemented");
    expect(body.notes).toBe("Lab implementation note.");
    expect(body.expected_updated_at).toBe(controlDetailSeed.implementation?.updated_at);
    expect(body).not.toHaveProperty("permissions");
    expect(body).not.toHaveProperty("id");
    expect((inits[patchIndex]?.headers as Headers).get("X-CSRF-Token")).toBe("gov-csrf");
    expect(inits[patchIndex]?.credentials).toBe("include");
    expect(calls.some((url) => url.includes("/api/v1/governance/summary"))).toBe(true);
  });

  it("keeps implementation and tests read-only without control.manage", async () => {
    const readOnlyUser = {
      ...currentUserFixture,
      permissions: ["control.read", "evidence.read"],
    };
    installApiFetch(
      (url) => {
        if (url.includes("/api/v1/auth/session")) {
          return jsonResponse({ ...authenticatedSessionFixture, user: readOnlyUser });
        }
        if (url.includes("/api/v1/auth/me")) {
          return jsonResponse(readOnlyUser);
        }
        return undefined;
      },
      { authenticated: true, allowAuthOverride: true },
    );
    const user = userEvent.setup();
    const page = await openControls(user);
    expect(await within(page).findByTestId("control-implementation-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("control-implementation-save")).not.toBeInTheDocument();
    expect(within(page).getByTestId("control-test-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("control-test-create")).not.toBeInTheDocument();
    expect(within(page).getByTestId("evidence-create-readonly")).toBeInTheDocument();
    expect(within(page).getByTestId("evidence-link-readonly")).toBeInTheDocument();
  });

  it("handles implementation 409 and 422 without claiming success", async () => {
    setCsrfToken("gov-csrf");
    installApiFetch((url, init) => {
      if (url.includes("/implementation") && init?.method === "PATCH") {
        const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
        if (body.status === "not_applicable") {
          return jsonResponse({ code: "validation_error", message: "Invalid status." }, 422);
        }
        return jsonResponse(
          {
            code: "conflict",
            message: "The control implementation was modified by another request.",
          },
          409,
        );
      }
      return undefined;
    });
    const user = userEvent.setup();
    await openControls(user);
    await screen.findByTestId("control-implementation-editor");

    await user.selectOptions(screen.getByTestId("control-implementation-status"), "implemented");
    await user.click(screen.getByTestId("control-implementation-save"));
    expect(await screen.findByTestId("control-implementation-error")).toHaveTextContent(
      /modified by another request/i,
    );
    expect(screen.getByTestId("control-implementation-reload")).toBeInTheDocument();
    expect(screen.queryByTestId("control-implementation-success")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByTestId("control-implementation-status"), "not_applicable");
    await user.click(screen.getByTestId("control-implementation-save"));
    expect(await screen.findByTestId("control-implementation-error")).toHaveTextContent(
      "Invalid status.",
    );
  });

  it("records a manual control test and shows the CTEST id", async () => {
    setCsrfToken("gov-csrf");
    const { calls, inits } = installApiFetch();
    const user = userEvent.setup();
    const page = await openControls(user);

    expect(within(page).getByTestId("control-test-manual-label")).toHaveTextContent(
      /not automated control validation/i,
    );
    await user.selectOptions(screen.getByTestId("control-test-result"), "pass");
    await user.type(screen.getByTestId("control-test-notes"), "Manual walkthrough.");
    await user.click(screen.getByTestId("control-test-create"));

    expect(await screen.findByTestId("control-test-success")).toHaveTextContent("CTEST-0001");
    const postIndex = calls.findIndex(
      (url, index) =>
        url.includes("/api/v1/governance/controls/CTRL-0002/tests") &&
        inits[index]?.method === "POST",
    );
    expect(postIndex).toBeGreaterThanOrEqual(0);
    const body = JSON.parse(String(inits[postIndex]?.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["notes", "result"].sort());
    expect(body.result).toBe("pass");
    expect((inits[postIndex]?.headers as Headers).get("X-CSRF-Token")).toBe("gov-csrf");
    expect(page.textContent).not.toMatch(/automated validation succeeded/i);
  });

  it("creates evidence metadata then offers private file upload and links it", async () => {
    setCsrfToken("gov-csrf");
    const { calls, inits } = installApiFetch();
    const user = userEvent.setup();
    const page = await openControls(user);

    expect(within(page).getByTestId("evidence-workflow-copy")).toHaveTextContent(
      /private file upload through AegisBridge/i,
    );
    expect(screen.queryByTestId("evidence-file-upload")).not.toBeInTheDocument();

    await user.type(screen.getByTestId("evidence-title"), "Manual export note");
    await user.type(screen.getByTestId("evidence-sha256"), "b".repeat(64));
    await user.click(screen.getByTestId("evidence-create"));

    expect(await screen.findByTestId("evidence-created-summary")).toHaveTextContent("EVID-0042");
    expect(screen.getByTestId("evidence-created-summary")).toHaveTextContent("object_stored=false");
    expect(screen.getByTestId("evidence-created-summary")).toHaveTextContent(
      "integrity_verified=false",
    );
    expect(screen.getByTestId("evidence-file-upload")).toBeInTheDocument();

    const createIndex = calls.findIndex(
      (url, index) => url.endsWith("/api/v1/evidence") && inits[index]?.method === "POST",
    );
    expect(createIndex).toBeGreaterThanOrEqual(0);
    const createBody = JSON.parse(String(inits[createIndex]?.body)) as Record<string, unknown>;
    expect(createBody).not.toHaveProperty("object_uri");
    expect(createBody).not.toHaveProperty("file");
    expect(createBody.sha256).toBe("b".repeat(64));

    await user.click(screen.getByTestId("evidence-link-created"));
    expect(await screen.findByTestId("control-evidence-success")).toHaveTextContent(/linked/i);
    expect(
      calls.some(
        (url, index) =>
          url.includes("/api/v1/governance/controls/CTRL-0002/evidence/EVID-0042") &&
          inits[index]?.method === "POST",
      ),
    ).toBe(true);
  });

  it("rejects malformed SHA-256 in the UI before claiming success", async () => {
    setCsrfToken("gov-csrf");
    installApiFetch();
    const user = userEvent.setup();
    await openControls(user);
    await user.type(screen.getByTestId("evidence-title"), "Bad hash");
    await user.type(screen.getByTestId("evidence-sha256"), "not-a-hash");
    await user.click(screen.getByTestId("evidence-create"));
    expect(await screen.findByTestId("control-evidence-error")).toHaveTextContent(
      /64 hexadecimal/i,
    );
    expect(screen.queryByTestId("evidence-created-summary")).not.toBeInTheDocument();
  });

  it("requires confirmation to unlink and does not claim evidence deletion", async () => {
    setCsrfToken("gov-csrf");
    const { calls, inits } = installApiFetch();
    const user = userEvent.setup();
    const page = await openControls(user);

    expect(await within(page).findByTestId("control-evidence-row-EVID-0041")).toBeInTheDocument();
    await user.click(screen.getByTestId("control-evidence-unlink-EVID-0041"));
    expect(screen.getByText(/Removes the association only/i)).toBeInTheDocument();
    await user.click(screen.getByTestId("control-evidence-unlink-confirm-EVID-0041"));

    expect(await screen.findByTestId("control-evidence-success")).toHaveTextContent(
      /was not deleted/i,
    );
    expect(screen.getByTestId("control-evidence-success").textContent).not.toMatch(
      /file deleted|object deleted|storage/i,
    );
    expect(
      calls.some(
        (url, index) =>
          url.includes("/api/v1/governance/controls/CTRL-0002/evidence/EVID-0041") &&
          inits[index]?.method === "DELETE",
      ),
    ).toBe(true);
  });

  it("does not infer permissions from role names", async () => {
    const labeledAdmin = {
      ...currentUserFixture,
      roles: ["Administrator"],
      permissions: ["control.read"],
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
    await openControls(user);
    expect(await screen.findByTestId("control-implementation-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("control-implementation-save")).not.toBeInTheDocument();
  });
});
