import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import {
  emptyGovernanceSummary,
  governanceSummary,
  installApiFetch,
  jsonResponse,
} from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

describe("Governance & Compliance page", () => {
  it("renders the governance summary from the API with seeded labeling", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/governance"] });
    const page = screen.getByTestId("governance-page");
    expect(
      within(page).getByRole("heading", { name: /Governance & compliance/i }),
    ).toBeInTheDocument();
    expect(await within(page).findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();
    expect(within(page).getAllByText(/Development seeded data/i).length).toBeGreaterThan(0);
    expect(within(page).getByText(/not live production/i)).toBeInTheDocument();
    expect(within(page).queryByText(/^SIMULATED$/)).not.toBeInTheDocument();
    expect(
      within(page).getAllByText(/There is no aggregate security score/i).length,
    ).toBeGreaterThan(0);
    expect(within(page).queryByText(/overall security score/i)).not.toBeInTheDocument();
    expect(within(page).getByText("Controls passing")).toBeInTheDocument();
    expect(within(page).getAllByText("Not recorded").length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/No control test results stored/i).length).toBeGreaterThan(0);
    expect(within(page).queryByText("72 / 96")).not.toBeInTheDocument();
    expect(within(page).queryByText("Q4 control assessment")).not.toBeInTheDocument();
  });

  it("shows the loading skeleton before the governance response arrives", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/governance/summary")) return new Promise(() => undefined);
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/governance"] });
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.queryByText("72 / 96")).not.toBeInTheDocument();
    expect(screen.queryByText("POL-0001")).not.toBeInTheDocument();
  });

  it("shows an error with retry and does not substitute fixture counts", async () => {
    let fail = true;
    installApiFetch((url) => {
      if (url.includes("/api/v1/governance/summary")) {
        return fail ? jsonResponse({ message: "down" }, 500) : jsonResponse(governanceSummary);
      }
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/governance"] });
    expect(await screen.findByRole("alert")).toHaveTextContent("Governance data unavailable");
    expect(screen.queryByText("72 / 96")).not.toBeInTheDocument();
    expect(screen.queryByText("Q4 control assessment")).not.toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/partial/i)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Policies" }));
    expect(await screen.findByText(/POL-0001/)).toBeInTheDocument();
    expect(screen.queryByText("72 / 96")).not.toBeInTheDocument();
  });

  it("renders framework summaries and API control counts without licensed CIS text", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/governance"] });
    const page = screen.getByTestId("governance-page");
    expect(await within(page).findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Frameworks" }));
    expect(within(page).getByRole("heading", { name: "Framework coverage" })).toBeInTheDocument();
    expect(within(page).getByText("NIST SP 800-53")).toBeInTheDocument();
    expect(within(page).getByText("Rev. 5")).toBeInTheDocument();
    expect(within(page).getAllByTestId("framework-card")).toHaveLength(1);
    expect(within(page).getByText("1")).toBeInTheDocument();
    expect(within(page).getByText(/Licensed control text is not included/i)).toBeInTheDocument();
    expect(within(page).getByText(/NIST CSF 2\.0/i)).toBeInTheDocument();
    expect(within(page).getByText(/CIS Controls v8\.1/i)).toBeInTheDocument();
    expect(within(page).getByText(/OWASP ASVS 5\.0\.0/i)).toBeInTheDocument();
    expect(page.textContent).not.toMatch(/establish and maintain/i);
    expect(within(page).queryByText("CIS-5")).not.toBeInTheDocument();
    expect(within(page).queryByText("72 / 96")).not.toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Controls" }));
    const controls = within(page).getByTestId("controls-list");
    expect(within(controls).getByText("Partial")).toBeInTheDocument();
    expect(within(controls).getByText("1")).toBeInTheDocument();
    expect(within(controls).getByText(/No control test results stored/i)).toBeInTheDocument();
  });

  it("renders evidence freshness and stored policy and access-review records", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/governance"] });
    const page = screen.getByTestId("governance-page");
    expect(await within(page).findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Evidence" }));
    const evidence = within(page).getByTestId("evidence-list");
    expect(within(evidence).getByText(/Recorded evidence: 1/i)).toBeInTheDocument();
    expect(within(evidence).getByText(/With SHA-256: 1/i)).toBeInTheDocument();
    expect(within(evidence).getByText(/No evidence due dates are stored/i)).toBeInTheDocument();
    expect(within(evidence).queryByText("Stale")).not.toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Policies" }));
    expect(within(page).getByTestId("policies-list")).toHaveTextContent("POL-0001");
    expect(within(page).getByTestId("policies-list")).toHaveTextContent("Access control policy");
    expect(within(page).getByTestId("policies-list")).toHaveTextContent("Draft");

    await user.click(within(page).getByRole("tab", { name: "Access reviews" }));
    expect(within(page).getByTestId("access-reviews-list")).toHaveTextContent("ARV-0001");
    expect(within(page).getByTestId("access-reviews-list")).toHaveTextContent(
      "October access review",
    );
    expect(within(page).getByTestId("access-reviews-list")).toHaveTextContent(
      "Open findings 1 / 1",
    );
  });

  it("shows honest empty states when policies, reviews, tests, and evidence are absent", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/governance/summary")) return jsonResponse(emptyGovernanceSummary);
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/governance"] });
    const page = screen.getByTestId("governance-page");
    expect(
      (await within(page).findAllByText(/No control test results stored/i)).length,
    ).toBeGreaterThan(0);
    expect(within(page).queryByText("72 / 96")).not.toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Evidence" }));
    expect(within(page).getByTestId("evidence-list")).toHaveTextContent(
      "No evidence freshness data is stored.",
    );

    await user.click(within(page).getByRole("tab", { name: "Policies" }));
    expect(within(page).getByTestId("policies-list")).toHaveTextContent(
      "No policy records are stored.",
    );

    await user.click(within(page).getByRole("tab", { name: "Access reviews" }));
    expect(within(page).getByTestId("access-reviews-list")).toHaveTextContent(
      "No access reviews are stored.",
    );
  });

  it("keeps governance navigable from the sidebar", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/overview"] });
    const link = screen.getByRole("link", { name: "Governance & Compliance" });
    expect(link).toHaveAttribute("href", "/governance");
  });
});
