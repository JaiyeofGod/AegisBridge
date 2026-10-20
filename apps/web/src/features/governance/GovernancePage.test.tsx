import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { renderWithProviders } from "@/test/render";

describe("Governance & Compliance page", () => {
  it("renders /governance with simulated labeling and no aggregate score", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/governance"] });

    const page = screen.getByTestId("governance-page");
    expect(page).toBeInTheDocument();
    expect(
      within(page).getByRole("heading", { name: /Governance & compliance/i }),
    ).toBeInTheDocument();
    expect(within(page).getAllByText(/simulated/i).length).toBeGreaterThan(0);
    expect(within(page).getByText(/There is no aggregate security score/i)).toBeInTheDocument();
    expect(within(page).queryByText(/overall security score/i)).not.toBeInTheDocument();
    expect(within(page).queryByText(/composite score/i)).not.toBeInTheDocument();
  });

  it("renders summary metrics and assessment work", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/governance"] });
    const page = screen.getByTestId("governance-page");

    expect(within(page).getByText("Controls passing")).toBeInTheDocument();
    expect(within(page).getByText("72 / 96")).toBeInTheDocument();
    expect(within(page).getByText("Evidence requests")).toBeInTheDocument();
    expect(within(page).getByText("Policy reviews")).toBeInTheDocument();
    expect(within(page).getByText("Access review")).toBeInTheDocument();
    expect(within(page).getByRole("heading", { name: "Assessment work" })).toBeInTheDocument();
    expect(within(page).getByText("Q4 control assessment")).toBeInTheDocument();
    expect(within(page).getAllByText("Gap identified").length).toBeGreaterThan(0);
  });

  it("renders framework sections with required framework scope", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/governance"] });

    await user.click(screen.getByRole("tab", { name: "Frameworks" }));
    const page = screen.getByTestId("governance-page");
    expect(within(page).getByRole("heading", { name: "Framework coverage" })).toBeInTheDocument();
    expect(within(page).getByText(/NIST Cybersecurity Framework/i)).toBeInTheDocument();
    expect(within(page).getByText("2.0")).toBeInTheDocument();
    expect(within(page).getByText(/CIS Controls/i)).toBeInTheDocument();
    expect(within(page).getByText(/v8\.1/i)).toBeInTheDocument();
    expect(within(page).getByText(/NIST SP 800-53/i)).toBeInTheDocument();
    expect(within(page).getByText(/Rev\. 5/i)).toBeInTheDocument();
    expect(within(page).getByText(/OWASP ASVS/i)).toBeInTheDocument();
    expect(within(page).getByText("5.0.0")).toBeInTheDocument();
    expect(within(page).getAllByTestId("framework-card").length).toBe(4);
  });

  it("exposes control and evidence status as text semantics", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/governance"] });
    const page = screen.getByTestId("governance-page");

    await user.click(screen.getByRole("tab", { name: "Controls" }));
    const controls = within(page).getByTestId("controls-list");
    expect(within(controls).getAllByText("Implemented").length).toBeGreaterThan(0);
    expect(within(controls).getAllByText("Partially Implemented").length).toBeGreaterThan(0);
    expect(within(controls).getByText("Not Implemented")).toBeInTheDocument();
    expect(within(controls).getByText(/CIS identifier only/i)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Evidence" }));
    const evidence = within(page).getByTestId("evidence-list");
    expect(within(evidence).getByText("Stale")).toBeInTheDocument();
    expect(within(evidence).getAllByText("Current").length).toBeGreaterThan(0);
    expect(within(evidence).getByText("Updating")).toBeInTheDocument();
  });

  it("keeps governance navigable from the sidebar", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/overview"] });
    const link = screen.getByRole("link", { name: "Governance & Compliance" });
    expect(link).toHaveAttribute("href", "/governance");
  });
});
