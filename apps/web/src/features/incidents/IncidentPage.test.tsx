import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import {
  assetPage,
  emptyIncidentDetail,
  incidentPrimary,
  installApiFetch,
  jsonResponse,
} from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

function compromiseClaims(text: string) {
  const lower = text.toLowerCase();
  const matches = lower.matchAll(/confirmed compromise/g);
  return [...matches].filter((match) => {
    const prefix = lower.slice(Math.max(0, match.index - 4), match.index);
    return !prefix.trimEnd().endsWith("no");
  });
}

describe("Incident response", () => {
  it("renders the incident queue from the API with seeded labeling", async () => {
    await renderWithProviders(<AppRouter />, { initialEntries: ["/incidents"] });
    const page = screen.getByTestId("incidents-page");
    expect(
      within(page).getByRole("heading", { level: 1, name: "Incident response" }),
    ).toBeInTheDocument();
    expect(await within(page).findByText("DEVELOPMENT / SEEDED")).toBeInTheDocument();
    expect(within(page).getAllByText(/Development seeded data/i).length).toBeGreaterThan(0);
    expect(within(page).getByText(/not live production/i)).toBeInTheDocument();
    expect(within(page).queryByText(/^SIMULATED$/)).not.toBeInTheDocument();
    expect(within(page).getAllByText("INC-0001").length).toBeGreaterThan(0);
    expect(within(page).queryByText("INC-002")).not.toBeInTheDocument();
    expect(within(page).getByText(/no aggregate security score/i)).toBeInTheDocument();
    expect(within(page).getByText(/NIST SP 800-61 Rev\. 3/i)).toBeInTheDocument();
    expect(compromiseClaims(page.textContent ?? "")).toEqual([]);
    expect(page.textContent?.toLowerCase()).toContain("no confirmed compromise");
    expect(within(page).getByTestId("incident-context")).toHaveTextContent("Medium severity");
    expect(within(page).getByTestId("incident-context")).toHaveTextContent("Investigating status");
    expect(within(page).getByTestId("incident-context")).toHaveTextContent("Not stored");
    expect(
      await within(page).findByText("Opened from simulated authentication failures."),
    ).toBeInTheDocument();
    expect(within(page).getAllByText("EVID-0041").length).toBeGreaterThan(0);
    expect(within(page).queryByText("TASK-201")).not.toBeInTheDocument();
    expect(within(page).queryByText("IOC-301")).not.toBeInTheDocument();
    expect(within(page).queryByText("EV-081")).not.toBeInTheDocument();
  });

  it("shows the loading skeleton before the incident response arrives", async () => {
    installApiFetch((url) => {
      if (url.includes("/api/v1/incidents")) return new Promise(() => undefined);
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    await renderWithProviders(<AppRouter />, { initialEntries: ["/incidents"] });
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.queryByText("INC-0001")).not.toBeInTheDocument();
    expect(screen.queryByText("INC-002")).not.toBeInTheDocument();
  });

  it("shows an error with retry and does not substitute fixture rows", async () => {
    let fail = true;
    installApiFetch((url) => {
      if (url.includes("/api/v1/incidents") && !/\/incidents\/[^?]+/.test(url)) {
        return fail
          ? jsonResponse({ message: "down" }, 500)
          : jsonResponse(assetPage([incidentPrimary]));
      }
      if (/\/api\/v1\/incidents\/[^?]+/.test(url)) return jsonResponse(emptyIncidentDetail);
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/incidents"] });
    expect(await screen.findByRole("alert")).toHaveTextContent("Incident data unavailable");
    expect(screen.queryByText("INC-002")).not.toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect((await screen.findAllByText("INC-0001")).length).toBeGreaterThan(0);
  });

  it("maps incident filters to backend query parameters", async () => {
    const { calls } = installApiFetch();
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/incidents"] });
    expect((await screen.findAllByText("INC-0099")).length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByRole("combobox", { name: /^severity$/i }), "medium");
    await waitFor(() => {
      expect(calls.some((url) => url.includes("severity=medium"))).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryAllByText("INC-0099")).toHaveLength(0);
    });
    expect(screen.getAllByText("INC-0001").length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByRole("combobox", { name: /^severity$/i }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: /^status$/i }), "investigating");
    await user.selectOptions(screen.getByRole("combobox", { name: /^owner$/i }), "Jonah Hale");
    await user.type(screen.getByRole("searchbox", { name: /search records/i }), "authentication");
    await waitFor(() => {
      expect(calls.some((url) => url.includes("status=investigating"))).toBe(true);
      expect(calls.some((url) => url.includes("owner=Jonah"))).toBe(true);
      expect(calls.some((url) => url.includes("search=authentication"))).toBe(true);
    });

    await user.selectOptions(
      screen.getByRole("combobox", { name: /containment state/i }),
      "Not started",
    );
    await waitFor(() => {
      expect(calls.some((url) => url.includes("containment_state="))).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryAllByText("INC-0001")).toHaveLength(0);
    });
    expect(screen.getAllByText(/No incidents are stored/i).length).toBeGreaterThan(0);
    expect(screen.queryByText("INC-002")).not.toBeInTheDocument();
  });

  it("renders API detail sections and honest empty relationships", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/incidents"] });
    const page = screen.getByTestId("incidents-page");
    expect(await within(page).findByText("INC-0001")).toBeInTheDocument();
    expect(within(page).getAllByText("No related alerts are stored.").length).toBeGreaterThan(0);
    expect(within(page).getAllByText("No affected assets are stored.").length).toBeGreaterThan(0);
    expect(within(page).getByTestId("incident-context")).toHaveTextContent("No tasks are stored.");

    await user.click(within(page).getByRole("tab", { name: "Timeline" }));
    expect(within(page).getByTestId("incident-timeline")).toHaveTextContent(
      "Opened from simulated authentication failures.",
    );

    await user.click(within(page).getByRole("tab", { name: "Tasks" }));
    expect(within(page).getByTestId("incident-tasks")).toHaveTextContent("No tasks are stored.");
    expect(within(page).queryByText("Overdue")).not.toBeInTheDocument();
    expect(within(page).queryByText("On schedule")).not.toBeInTheDocument();

    await user.click(within(page).getByRole("tab", { name: "Indicators" }));
    expect(within(page).getByTestId("incident-indicators")).toHaveTextContent(
      "No indicators are stored.",
    );

    await user.click(within(page).getByRole("tab", { name: "Evidence" }));
    expect(within(page).getByTestId("incident-evidence")).toHaveTextContent("EVID-0041");
    expect(within(page).getByTestId("incident-evidence")).toHaveTextContent(
      "SHA-256 fixture-sha256",
    );
    expect(within(page).getByTestId("incident-evidence")).toHaveTextContent("Reference only.");
  });

  it("shows explicit empty states when the detail arrays are empty", async () => {
    installApiFetch((url) => {
      if (/\/api\/v1\/incidents\/[^?]+/.test(url)) return jsonResponse(emptyIncidentDetail);
      if (url.includes("/api/v1/incidents")) return jsonResponse(assetPage([incidentPrimary]));
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/incidents"] });
    const page = screen.getByTestId("incidents-page");
    expect(await within(page).findByText("INC-0001")).toBeInTheDocument();
    expect(within(page).getByTestId("incident-context")).toHaveTextContent(
      "No timeline events are stored.",
    );
    expect(within(page).getByTestId("incident-context")).toHaveTextContent("No tasks are stored.");
    expect(within(page).getByTestId("incident-context")).toHaveTextContent(
      "No evidence is stored.",
    );
    expect(within(page).getByTestId("incident-context")).toHaveTextContent(
      "No related alerts are stored.",
    );
    expect(within(page).getByTestId("incident-context")).toHaveTextContent(
      "No affected assets are stored.",
    );

    await user.click(within(page).getByRole("tab", { name: "Indicators" }));
    expect(within(page).getByTestId("incident-indicators")).toHaveTextContent(
      "No indicators are stored.",
    );
  });
});
