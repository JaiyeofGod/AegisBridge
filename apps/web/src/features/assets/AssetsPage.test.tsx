import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import {
  assetListItems,
  assetPage,
  finAppDetail,
  finAppListItem,
  installApiFetch,
  jsonResponse,
} from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

describe("Asset inventory", () => {
  beforeEach(() => {
    installApiFetch();
  });

  it("renders the asset list from the API with seeded labeling", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/assets"] });
    const page = screen.getByTestId("assets-page");
    expect(
      within(page).getByRole("heading", { level: 1, name: "Asset inventory" }),
    ).toBeInTheDocument();
    expect(await within(page).findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();
    expect(within(page).getByText(/Development seeded data/i)).toBeInTheDocument();
    expect(within(page).getAllByText(/FIN-APP-01/).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/AST-0007/).length).toBeGreaterThan(0);
    expect(within(page).getAllByText("reference_only").length).toBeGreaterThan(0);
    expect(within(page).getByText(/There is no aggregate security score/i)).toBeInTheDocument();
    expect(within(page).queryByText("SURICATA-01")).not.toBeInTheDocument();
    expect(within(page).queryByText("LX-DB-02")).not.toBeInTheDocument();
    expect(within(page).queryByText("7 open findings")).not.toBeInTheDocument();
    expect(within(page).queryByText(/^SIMULATED$/)).not.toBeInTheDocument();
  });

  it("maps inventory filters to backend query parameters", async () => {
    const { calls } = installApiFetch();
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/assets"] });
    expect((await screen.findAllByText(/WIN-WS-07/)).length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByRole("combobox", { name: /criticality/i }), "critical");

    await waitFor(() => {
      expect(calls.some((url) => url.includes("criticality=critical"))).toBe(true);
    });
    expect((await screen.findAllByText(/FIN-APP-01/)).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.queryAllByText(/WIN-WS-07/)).toHaveLength(0);
    });
  });

  it("loads FIN-APP-01 from the API and keeps absent links empty", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/assets/FIN-APP-01"] });

    const page = await screen.findByTestId("asset-detail-page");
    expect(await within(page).findByRole("heading", { name: "FIN-APP-01" })).toBeInTheDocument();
    expect(within(page).getByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();
    expect(within(page).getByTestId("asset-profile")).toHaveTextContent("AST-0007");
    expect(within(page).getAllByText(/VULN-0041/).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/RISK-0021/).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/CTRL-0002/).length).toBeGreaterThan(0);
    expect(within(page).getByTestId("asset-evidence")).toHaveTextContent("EVID-0041");
    expect(within(page).queryByText(/VF-041/)).not.toBeInTheDocument();
    expect(within(page).queryByText(/AL-104/)).not.toBeInTheDocument();
    expect(within(page).queryByText(/EV-041/)).not.toBeInTheDocument();
    expect(within(page).getByText("Not labeled on the finding record")).toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Alerts" }));
    expect(
      within(page).getByText(/No connected records are stored for this view/i),
    ).toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Activity" }));
    expect(
      within(page).getByText(/No activity records are stored for this asset/i),
    ).toBeInTheDocument();
  });

  it("does not replace an empty API result with fixture rows", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/assets")) return jsonResponse(assetPage([]));
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/assets"] });
    const page = await screen.findByTestId("assets-page");
    expect(
      (await within(page).findAllByText(/No assets are stored for the current request/i)).length,
    ).toBeGreaterThan(0);
    expect(within(page).queryByText("FIN-APP-01")).not.toBeInTheDocument();
    expect(within(page).queryByText("SURICATA-01")).not.toBeInTheDocument();
    expect(assetListItems).toHaveLength(2);
    expect(finAppDetail.id).toBe(finAppListItem.id);
  });
});
