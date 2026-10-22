import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import {
  CONTROL_PAGE_SIZE,
  CONTROL_SELECTOR_PAGE_SIZE,
} from "@/features/governance/catalogConstants";
import { setCsrfToken } from "@/services/csrf";
import { installApiFetch } from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

async function openControls(user: ReturnType<typeof userEvent.setup>) {
  await renderWithProviders(<AppRouter />, { initialEntries: ["/governance"] });
  const page = screen.getByTestId("governance-page");
  await user.click(await within(page).findByRole("tab", { name: "Controls" }));
  expect(await within(page).findByTestId("governance-control-catalog")).toBeInTheDocument();
  return page;
}

async function openPolicies(user: ReturnType<typeof userEvent.setup>) {
  await renderWithProviders(<AppRouter />, { initialEntries: ["/governance"] });
  const page = screen.getByTestId("governance-page");
  await user.click(await within(page).findByRole("tab", { name: "Policies" }));
  expect(await within(page).findByTestId("policy-management-panel")).toBeInTheDocument();
  return page;
}

describe("Governance control catalog discovery", () => {
  it("sends server-side page/page_size and supports next/previous across pages", async () => {
    const { calls } = installApiFetch();
    const user = userEvent.setup();
    const page = await openControls(user);

    const listCalls = () =>
      calls.filter((url) => /\/api\/v1\/governance\/controls(\?|$)/.test(url));
    expect(listCalls().length).toBeGreaterThan(0);
    const first = listCalls()[0] ?? "";
    expect(first).toContain("page=1");
    expect(first).toContain(`page_size=${CONTROL_PAGE_SIZE}`);
    expect(first).not.toContain("page_size=50");

    const pager = within(page).getByTestId("controls-catalog-pager");
    expect(within(pager).getByTestId("controls-catalog-pager-status")).toHaveTextContent(
      /Page 1 of/i,
    );
    expect(within(pager).getByTestId("controls-catalog-pager-previous")).toBeDisabled();
    expect(within(pager).getByTestId("controls-catalog-pager-next")).toBeEnabled();

    await user.click(within(pager).getByTestId("controls-catalog-pager-next"));
    await waitFor(() => {
      expect(listCalls().some((url) => url.includes("page=2"))).toBe(true);
    });
    expect(within(pager).getByTestId("controls-catalog-pager-status")).toHaveTextContent(
      /Page 2 of/i,
    );
    expect(within(pager).getByTestId("controls-catalog-pager-previous")).toBeEnabled();

    await user.click(within(pager).getByTestId("controls-catalog-pager-previous"));
    await waitFor(() => {
      expect(within(pager).getByTestId("controls-catalog-pager-status")).toHaveTextContent(
        /Page 1 of/i,
      );
    });
    expect(within(pager).getByTestId("controls-catalog-pager-previous")).toBeDisabled();
  });

  it("sends q, framework, status, and sort to the API", async () => {
    const { calls } = installApiFetch();
    const user = userEvent.setup();
    const page = await openControls(user);

    await user.type(within(page).getByTestId("controls-catalog-search"), "least");
    await waitFor(() => {
      expect(
        calls.some(
          (url) => url.includes("/api/v1/governance/controls?") && url.includes("q=least"),
        ),
      ).toBe(true);
    });

    await user.selectOptions(within(page).getByTestId("controls-catalog-framework"), "NIST-800-53");
    await user.selectOptions(within(page).getByTestId("controls-catalog-status"), "planned");
    await user.selectOptions(within(page).getByTestId("controls-catalog-sort"), "title");
    await user.selectOptions(within(page).getByTestId("controls-catalog-direction"), "desc");

    await waitFor(() => {
      expect(
        calls.some(
          (url) =>
            url.includes("framework=NIST-800-53") &&
            url.includes("implementation_status=planned") &&
            url.includes("sort=title") &&
            url.includes("direction=desc"),
        ),
      ).toBe(true);
    });

    expect(await within(page).findByTestId("governance-control-CTRL-0011")).toBeInTheDocument();
  });

  it("shows no-match empty state without treating it as an error", async () => {
    installApiFetch();
    const user = userEvent.setup();
    const page = await openControls(user);
    await user.type(within(page).getByTestId("controls-catalog-search"), "zzznomatch");
    expect(await within(page).findByTestId("controls-catalog-empty")).toHaveTextContent(
      /No controls match the current search or filters/i,
    );
    expect(within(page).queryByText(/Controls unavailable/i)).not.toBeInTheDocument();
  });
});

describe("Policy catalog discovery", () => {
  it("sends server-side pagination, search, status, and sort", async () => {
    const { calls } = installApiFetch();
    const user = userEvent.setup();
    const page = await openPolicies(user);

    const listCalls = () => calls.filter((url) => /\/api\/v1\/policies(\?|$)/.test(url));
    expect(listCalls()[0]).toContain("page=1");
    expect(listCalls()[0]).toContain("page_size=25");
    expect(listCalls()[0]).not.toContain("page_size=50");

    await user.type(within(page).getByTestId("policies-catalog-search"), "access");
    await waitFor(() => {
      expect(
        calls.some((url) => url.includes("/api/v1/policies?") && url.includes("q=access")),
      ).toBe(true);
    });

    await user.selectOptions(within(page).getByTestId("policies-catalog-status"), "published");
    await user.selectOptions(within(page).getByTestId("policies-catalog-sort"), "title");
    await user.selectOptions(within(page).getByTestId("policies-catalog-direction"), "asc");

    await waitFor(() => {
      expect(
        calls.some(
          (url) =>
            url.includes("status=published") &&
            url.includes("sort=title") &&
            url.includes("direction=asc"),
        ),
      ).toBe(true);
    });

    expect(within(page).getByTestId("policies-list")).toHaveTextContent("POL-0001");
    expect(within(page).getByTestId("policies-list").textContent).not.toMatch(
      /Simulated access control policy summary/i,
    );
  });

  it("shows no-match empty state for policies", async () => {
    installApiFetch();
    const user = userEvent.setup();
    const page = await openPolicies(user);
    await user.type(within(page).getByTestId("policies-catalog-search"), "zzznomatch");
    expect(await within(page).findByTestId("policies-catalog-empty")).toHaveTextContent(
      /No policies match the current search or filters/i,
    );
  });
});

describe("Policy → control selector discovery", () => {
  it("fetches paginated controls with q and does not assume page_size=50", async () => {
    setCsrfToken("map-csrf");
    const { calls } = installApiFetch();
    const user = userEvent.setup();
    await openPolicies(user);

    await user.click(screen.getByTestId("policy-mapping-add"));
    expect(await screen.findByTestId("policy-mapping-control-select")).toBeInTheDocument();

    await waitFor(() => {
      const selectorCalls = calls.filter(
        (url) =>
          url.includes("/api/v1/governance/controls?") &&
          url.includes(`page_size=${CONTROL_SELECTOR_PAGE_SIZE}`),
      );
      expect(selectorCalls.length).toBeGreaterThan(0);
      expect(selectorCalls.every((url) => !url.includes("page_size=50"))).toBe(true);
    });

    await user.type(screen.getByTestId("policy-mapping-control-filter"), "CTRL-0014");
    await waitFor(() => {
      expect(
        calls.some(
          (url) => url.includes("/api/v1/governance/controls?") && url.includes("q=CTRL-0014"),
        ),
      ).toBe(true);
    });

    await user.click(await screen.findByTestId("policy-mapping-control-option-CTRL-0014"));
    await user.click(screen.getByTestId("policy-mapping-link-submit"));
    expect(await screen.findByTestId("policy-mapping-CTRL-0014")).toBeInTheDocument();
    expect(screen.getByTestId("policy-mapping-CTRL-0014").textContent).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-/i,
    );
  });
});
