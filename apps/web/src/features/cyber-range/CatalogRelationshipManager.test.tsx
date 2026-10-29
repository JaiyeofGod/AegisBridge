import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import type { LabSystemRelationshipItem } from "@/services/api-types";
import {
  assetPage,
  authenticatedSessionFixture,
  currentUserFixture,
  installApiFetch,
  jsonResponse,
  labSystemRelationships,
} from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

describe("Catalog relationship management", () => {
  it("shows labeled create controls for an authorized user and sends the stored payload", async () => {
    const rows = [...labSystemRelationships];
    const api = installRelationshipApi(rows);
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    await within(page).findAllByText("LAB-GW-01");

    await user.click(within(page).getByRole("button", { name: "Add catalog relationship" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Source system")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Relationship kind")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Target system")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("documented catalog relationship");
    expect(dialog).toHaveTextContent("does not detect network connectivity");
    expect(within(dialog).getByLabelText("Source system")).toHaveValue("LAB-GW-01");
    expect(within(dialog).getByLabelText("Target system")).not.toHaveValue("LAB-GW-01");
    await user.selectOptions(within(dialog).getByLabelText("Target system"), "LAB-GW-01");
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Source and target must be different systems.",
    );
    expect(
      within(dialog).getByRole("button", { name: "Save catalog relationship" }),
    ).toBeDisabled();

    await user.selectOptions(within(dialog).getByLabelText("Relationship kind"), "connected_to");
    await user.selectOptions(within(dialog).getByLabelText("Target system"), "KALI-RED-01");
    await user.click(within(dialog).getByRole("button", { name: "Save catalog relationship" }));

    const created = api.inits.find((init) => init?.method === "POST");
    expect(JSON.parse(String(created?.body))).toEqual({
      source_system_id: "LAB-GW-01",
      target_system_id: "KALI-RED-01",
      relationship_kind: "connected_to",
    });
    expect(
      await within(page).findByText("Connected to: LAB-GW-01 → KALI-RED-01"),
    ).toBeInTheDocument();
    expect(page.querySelector("[data-relationship-id='REL-0004']")).toBeInTheDocument();
    expect(within(page).getAllByRole("button", { name: /LAB-GW-01/ })[0]).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("edits a stored relationship and keeps the selected system", async () => {
    const rows = [...labSystemRelationships];
    const api = installRelationshipApi(rows);
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    await within(page).findAllByText("LAB-GW-01");
    await user.click(within(page).getAllByRole("button", { name: /SEC-WAZUH-01/ })[0]);
    await user.click(within(page).getByRole("button", { name: "Edit REL-0001" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Source system")).toHaveValue("SEC-WAZUH-01");
    expect(within(dialog).getByLabelText("Target system")).toHaveValue("WIN-USER-01");
    await user.selectOptions(within(dialog).getByLabelText("Relationship kind"), "manages");
    await user.click(within(dialog).getByRole("button", { name: "Save catalog relationship" }));

    const edited = api.inits.find((init) => init?.method === "PATCH");
    expect(String(edited && api.calls[api.inits.indexOf(edited)])).toContain(
      "/system-relationships/REL-0001",
    );
    expect(JSON.parse(String(edited?.body))).toEqual({
      source_system_id: "SEC-WAZUH-01",
      target_system_id: "WIN-USER-01",
      relationship_kind: "manages",
    });
    expect(
      await within(page).findByText("Manages: SEC-WAZUH-01 → WIN-USER-01"),
    ).toBeInTheDocument();
    expect(within(page).getAllByRole("button", { name: /SEC-WAZUH-01/ })[0]).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("confirms deletion and removes only that catalog relationship", async () => {
    const rows = [...labSystemRelationships];
    const api = installRelationshipApi(rows);
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    await within(page).findAllByText("LAB-GW-01");
    await user.click(within(page).getAllByRole("button", { name: /SEC-WAZUH-01/ })[0]);
    await user.click(within(page).getByRole("button", { name: "Remove REL-0002" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(
      "Remove catalog relationship SEC-WAZUH-01 monitors LINUX-APP-01?",
    );
    expect(dialog).toHaveTextContent("does not delete either system");
    await user.click(within(dialog).getByRole("button", { name: "Confirm remove" }));

    expect(api.inits.some((init) => init?.method === "DELETE")).toBe(true);
    expect(await within(page).findByText("Catalog relationship removed.")).toBeInTheDocument();
    expect(
      within(page).queryByText("Monitors: SEC-WAZUH-01 → LINUX-APP-01"),
    ).not.toBeInTheDocument();
    expect(page.querySelector("[data-relationship-id='REL-0002']")).not.toBeInTheDocument();
    expect(within(page).getAllByRole("button", { name: /SEC-WAZUH-01/ })[0]).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows a backend validation error in the dialog", async () => {
    installRelationshipApi([...labSystemRelationships], {
      failCreate: "That catalog relationship is already stored.",
    });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    await within(page).findAllByText("LAB-GW-01");
    await user.click(within(page).getByRole("button", { name: "Add catalog relationship" }));
    await user.click(screen.getByRole("button", { name: "Save catalog relationship" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That catalog relationship is already stored.",
    );
  });

  it("closes the dialog from the keyboard and hides management without write permission", async () => {
    installRelationshipApi([...labSystemRelationships]);
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    await within(page).findAllByText("LAB-GW-01");
    const add = within(page).getByRole("button", { name: "Add catalog relationship" });
    await user.click(add);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(add).toHaveFocus();
  });

  it("hides relationship management from a read-only user", async () => {
    const readOnly = {
      ...currentUserFixture,
      roles: ["Read Only"],
      permissions: ["cyber_range.read"],
    };
    installApiFetch(
      (url) => {
        if (url.includes("/api/v1/auth/session")) {
          return jsonResponse({ ...authenticatedSessionFixture, user: readOnly });
        }
        if (url.includes("/api/v1/auth/me")) return jsonResponse(readOnly);
        return undefined;
      },
      { allowAuthOverride: true },
    );
    await renderWithProviders(<AppRouter />, { initialEntries: ["/cyber-range"] });
    const page = screen.getByTestId("cyber-range-page");
    expect((await within(page).findAllByText("LAB-GW-01")).length).toBeGreaterThan(0);
    expect(
      within(page).queryByRole("button", { name: "Add catalog relationship" }),
    ).not.toBeInTheDocument();
    expect(within(page).queryByRole("button", { name: /Edit REL-/ })).not.toBeInTheDocument();
    expect(within(page).queryByRole("button", { name: /Remove REL-/ })).not.toBeInTheDocument();
    expect(within(page).getByText("Monitors: SEC-WAZUH-01 → WIN-USER-01")).toBeInTheDocument();
  });
});

function installRelationshipApi(
  rows: LabSystemRelationshipItem[],
  options?: { failCreate?: string },
) {
  return installApiFetch((url, init) => {
    if (!url.includes("/api/v1/cyber-range/system-relationships")) return undefined;
    const method = init?.method ?? "GET";
    if (method === "GET") return jsonResponse(assetPage(rows));
    if (method === "POST") {
      if (options?.failCreate) {
        return jsonResponse({ code: "conflict", message: options.failCreate }, 409);
      }
      const body = JSON.parse(String(init?.body)) as Omit<LabSystemRelationshipItem, "id">;
      const created = { id: "REL-0004", ...body };
      rows.push(created);
      return jsonResponse(created);
    }
    if (method === "PATCH") {
      const id = decodeURIComponent(url.split("/system-relationships/")[1]?.split("?")[0] ?? "");
      const body = JSON.parse(String(init?.body)) as Omit<LabSystemRelationshipItem, "id">;
      const index = rows.findIndex((item) => item.id === id);
      if (index >= 0) rows[index] = { id, ...body };
      return jsonResponse(rows[index]);
    }
    if (method === "DELETE") {
      const id = decodeURIComponent(url.split("/system-relationships/")[1]?.split("?")[0] ?? "");
      const index = rows.findIndex((item) => item.id === id);
      const [removed] = rows.splice(index, 1);
      return jsonResponse(removed);
    }
    return undefined;
  });
}
