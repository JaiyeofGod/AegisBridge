import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import { installApiFetch } from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

const routes = [
  ["/signin", "signin-page"],
  ["/overview", "overview-page"],
  ["/governance", "governance-page"],
  ["/risks", "risks-page"],
  ["/assets", "assets-page"],
  ["/assets/FIN-APP-01", "asset-detail-page"],
  ["/vulnerabilities", "vulnerabilities-page"],
  ["/soc", "soc-page"],
  ["/incidents", "incidents-page"],
  ["/threat-intelligence", "threat-intel-page"],
  ["/cyber-range", "cyber-range-page"],
  ["/reports", "reports-page"],
  ["/administration", "administration-page"],
  ["/account/profile", "account-page"],
  ["/account/security", "account-page"],
  ["/account/preferences", "account-page"],
  ["/account/workspace", "account-page"],
] as const;

describe("Implemented routes", () => {
  it.each(routes)("%s resolves to its page", async (path, testId) => {
    installApiFetch(undefined, { authenticated: path === "/signin" ? false : true });
    await renderWithProviders(<AppRouter />, { initialEntries: [path] });
    expect(await screen.findByTestId(testId)).toBeInTheDocument();
    expect(screen.queryByText(/not implemented yet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reserved for a later phase/i)).not.toBeInTheDocument();
  });
});
