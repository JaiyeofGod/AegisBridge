import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { riskBand, riskScore } from "@/features/risk/risk-model";
import { setCsrfToken } from "@/services/csrf";
import {
  authenticatedSessionFixture,
  currentUserFixture,
  installApiFetch,
  jsonResponse,
  riskDetail,
} from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

describe("Risk page", () => {
  beforeEach(() => {
    installApiFetch();
  });

  it("renders the risk register from the API with seeded labeling", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    const page = screen.getByTestId("risks-page");
    expect(within(page).getByRole("heading", { name: "Risk register" })).toBeInTheDocument();
    expect(await within(page).findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();
    expect(within(page).getByText(/Development seeded data/i)).toBeInTheDocument();
    expect(within(page).getByText(/not live production/i)).toBeInTheDocument();
    expect(within(page).getAllByText(/RISK-0021/).length).toBeGreaterThan(0);
    expect(within(page).getByText(/There is no aggregate security score/i)).toBeInTheDocument();
    expect(within(page).queryByText("R-021")).not.toBeInTheDocument();
    expect(within(page).queryByText("R-014")).not.toBeInTheDocument();
    expect(within(page).queryByText(/^SIMULATED$/)).not.toBeInTheDocument();
  });

  it("keeps likelihood, impact, and score separate", async () => {
    expect(riskScore(3, 4)).toBe(12);
    expect(riskScore(4, 5)).toBe(20);
    expect(riskBand(20).label).toBe("Critical");

    await renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    const page = screen.getByTestId("risks-page");
    expect(
      await within(page).findByRole("columnheader", { name: "Likelihood" }),
    ).toBeInTheDocument();
    expect(within(page).getByRole("columnheader", { name: "Impact" })).toBeInTheDocument();
    expect(within(page).getByRole("columnheader", { name: "Risk score" })).toBeInTheDocument();
    expect(await within(page).findAllByText(/4 · Likely/i)).not.toHaveLength(0);
    expect(within(page).getAllByText(/5 · Severe/i).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/likelihood × impact/i).length).toBeGreaterThan(0);
    expect(within(page).getByText(/Residual score Not recorded/i)).toBeInTheDocument();
    expect(riskDetail.score).toBe(20);
  });

  it("shows the loading skeleton before the risk response arrives", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/risks")) return new Promise(() => undefined);
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.queryByText("RISK-0021")).not.toBeInTheDocument();
  });

  it("shows an error with retry and does not substitute fixture rows", async () => {
    let fail = true;
    installApiFetch((url) => {
      if (url.includes("/api/v1/risks")) {
        return fail ? jsonResponse({ message: "down" }, 500) : jsonResponse(assetPageOfRisks());
      }
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    expect(await screen.findByRole("alert")).toHaveTextContent("Risk data unavailable");
    expect(screen.queryByText("R-021")).not.toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect((await screen.findAllByText(/RISK-0021/)).length).toBeGreaterThan(0);
  });

  it("maps risk filters to backend query parameters", async () => {
    const { calls } = installApiFetch();
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    expect((await screen.findAllByText(/RISK-0002/)).length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByRole("combobox", { name: /risk level/i }), "critical");

    await waitFor(() => {
      expect(calls.some((url) => url.includes("risk_level=critical"))).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryAllByText(/RISK-0002/)).toHaveLength(0);
    });
    expect(screen.getAllByText(/RISK-0021/).length).toBeGreaterThan(0);
  });

  it("keeps risk management navigable from the sidebar", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/overview"] });
    expect(screen.getByRole("link", { name: "Risk Management" })).toHaveAttribute("href", "/risks");
  });

  it("allows risk.manage users to edit treatment with CSRF and supported fields only", async () => {
    setCsrfToken("risk-csrf");
    const { calls, inits } = installApiFetch();
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    expect(await screen.findByTestId("risk-treatment-editor")).toBeInTheDocument();

    await user.selectOptions(screen.getByTestId("treatment-strategy"), "mitigate");
    await user.selectOptions(screen.getByTestId("treatment-status"), "in_progress");
    await user.clear(screen.getByTestId("treatment-notes"));
    await user.type(
      screen.getByTestId("treatment-notes"),
      "Mitigation started in the lab seed environment.",
    );
    await user.click(screen.getByTestId("treatment-save"));

    expect(await screen.findByTestId("treatment-success")).toHaveTextContent("Treatment updated");
    const patchIndex = calls.findIndex(
      (url, index) => url.includes("/treatment") && inits[index]?.method === "PATCH",
    );
    expect(patchIndex).toBeGreaterThanOrEqual(0);
    const body = JSON.parse(String(inits[patchIndex]?.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["expected_updated_at", "notes", "status"].sort());
    expect(body.status).toBe("in_progress");
    expect(body.notes).toBe("Mitigation started in the lab seed environment.");
    expect(body.expected_updated_at).toBe(riskDetail.treatment_updated_at);
    expect((inits[patchIndex]?.headers as Headers).get("X-CSRF-Token")).toBe("risk-csrf");
    expect(inits[patchIndex]?.credentials).toBe("include");
  });

  it("keeps treatment read-only without risk.manage", async () => {
    const readOnlyUser = {
      ...currentUserFixture,
      permissions: ["risk.read", "asset.read"],
    };
    installApiFetch(
      (url) => {
        if (url.includes("/api/v1/auth/session")) {
          return jsonResponse({
            ...authenticatedSessionFixture,
            user: readOnlyUser,
          });
        }
        if (url.includes("/api/v1/auth/me")) {
          return jsonResponse(readOnlyUser);
        }
        return undefined;
      },
      { authenticated: true, allowAuthOverride: true },
    );
    await renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    expect(await screen.findByTestId("risk-treatment-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("risk-treatment-editor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("treatment-save")).not.toBeInTheDocument();
  });

  it("handles 409 treatment conflicts without overwriting", async () => {
    setCsrfToken("risk-csrf");
    installApiFetch(
      (url, init) => {
        if (url.includes("/treatment") && init?.method === "PATCH") {
          return jsonResponse(
            {
              code: "conflict",
              message: "The risk treatment was modified by another request.",
            },
            409,
          );
        }
        return undefined;
      },
      { authenticated: true },
    );
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    await screen.findByTestId("risk-treatment-editor");
    await user.selectOptions(screen.getByTestId("treatment-status"), "complete");
    await user.click(screen.getByTestId("treatment-save"));
    expect(await screen.findByTestId("treatment-error")).toHaveTextContent(
      /changed since you loaded it/i,
    );
    expect(screen.getByTestId("treatment-reload")).toBeInTheDocument();
  });

  it("handles 403 and 422 treatment failures honestly", async () => {
    setCsrfToken("risk-csrf");
    let mode: "403" | "422" = "403";
    installApiFetch(
      (url, init) => {
        if (url.includes("/treatment") && init?.method === "PATCH") {
          if (mode === "403") {
            return jsonResponse(
              { code: "forbidden", message: "Missing permission: risk.manage" },
              403,
            );
          }
          return jsonResponse(
            { code: "validation_error", message: "status is not a valid treatment status" },
            422,
          );
        }
        return undefined;
      },
      { authenticated: true },
    );
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/risks"] });
    await screen.findByTestId("risk-treatment-editor");
    await user.selectOptions(screen.getByTestId("treatment-status"), "deferred");
    await user.click(screen.getByTestId("treatment-save"));
    expect(await screen.findByTestId("treatment-error")).toHaveTextContent(/permission/i);

    mode = "422";
    await user.selectOptions(screen.getByTestId("treatment-status"), "cancelled");
    await user.click(screen.getByTestId("treatment-save"));
    expect(await screen.findByTestId("treatment-error")).toHaveTextContent(
      /valid treatment status/i,
    );
  });
});

function assetPageOfRisks() {
  return {
    page: 1,
    page_size: 100,
    total: 1,
    items: [riskDetail],
  };
}
