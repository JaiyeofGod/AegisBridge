import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import {
  anonymousSessionFixture,
  authenticatedSessionFixture,
  currentUserFixture,
  installApiFetch,
  jsonResponse,
} from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

const tactics = [
  { id: "TA0002", name: "Execution", short_name: "execution", release: "20.0" },
  { id: "TA0003", name: "Persistence", short_name: "persistence", release: "20.0" },
];

const parent = {
  id: "T1059",
  name: "Command and Scripting Interpreter",
  is_subtechnique: false,
  parent_technique_id: null,
  tactics: ["execution", "persistence"],
  release: "20.0",
};

const child = {
  id: "T1059.001",
  name: "PowerShell",
  is_subtechnique: true,
  parent_technique_id: "T1059",
  tactics: ["execution"],
  release: "20.0",
};

const credential = {
  id: "T1003",
  name: "OS Credential Dumping",
  is_subtechnique: false,
  parent_technique_id: null,
  tactics: ["credential-access"],
  release: "20.0",
};

const revoked = {
  id: "T9999",
  name: "Revoked Example",
  is_subtechnique: false,
  parent_technique_id: null,
  tactics: ["execution"],
  release: "20.0",
};

const hiddenUuid = "11111111-1111-4111-8111-111111111111";

function detail(id: string) {
  if (id === "T1059") {
    return {
      id: "T1059",
      name: parent.name,
      description: '<script>alert("xss")</script>',
      tactics,
      platforms: ["Windows", "Linux"],
      is_subtechnique: false,
      parent: null,
      revoked: false,
      deprecated: false,
      release: "20.0",
      modified_at: "2024-04-11T00:00:00+00:00",
      stix_id: `attack-pattern--${hiddenUuid}`,
      internal_id: hiddenUuid,
    };
  }
  if (id === "T1059.001") {
    return {
      id: "T1059.001",
      name: child.name,
      description: "PowerShell commands.",
      tactics: [tactics[0]],
      platforms: ["Windows"],
      is_subtechnique: true,
      parent: { id: "T1059", name: parent.name },
      revoked: false,
      deprecated: true,
      release: "20.0",
      modified_at: "2024-04-11T00:00:00+00:00",
    };
  }
  if (id === "T9999") {
    return {
      id: "T9999",
      name: revoked.name,
      description: "Retired technique.",
      tactics: [tactics[0]],
      platforms: [],
      is_subtechnique: false,
      parent: null,
      revoked: true,
      deprecated: false,
      release: "20.0",
      modified_at: null,
    };
  }
  return {
    id,
    name: credential.name,
    description: "Credential access technique.",
    tactics: [],
    platforms: ["Windows"],
    is_subtechnique: false,
    parent: null,
    revoked: false,
    deprecated: false,
    release: "20.0",
    modified_at: null,
  };
}

function catalogResponse(url: string) {
  if (url.includes("/api/v1/attack/tactics")) return jsonResponse(tactics);
  if (/\/api\/v1\/attack\/techniques\/[^/?]+/.test(url)) {
    const id = decodeURIComponent(url.split("/techniques/")[1]?.split("?")[0] ?? "");
    if (id === "T0000") return jsonResponse({ message: "traceback: secret" }, 404);
    return jsonResponse(detail(id));
  }
  if (!url.includes("/api/v1/attack/techniques")) return undefined;
  const params = new URL(url, "http://localhost").searchParams;
  const page = Number(params.get("page") ?? "1");
  const q = (params.get("q") ?? "").toLowerCase();
  const tactic = params.get("tactic") ?? "";
  const includeSubtechniques = params.get("include_subtechniques") !== "false";
  const includeDeprecated = params.get("include_deprecated") === "true";
  if (q === "t0000") {
    return jsonResponse({
      page: 1,
      page_size: 25,
      total: 1,
      items: [
        {
          id: "T0000",
          name: "Missing Technique",
          is_subtechnique: false,
          parent_technique_id: null,
          tactics: ["execution"],
          release: "20.0",
        },
      ],
    });
  }
  let items = [parent, child, credential];
  if (!includeSubtechniques) items = items.filter((item) => !item.is_subtechnique);
  if (includeDeprecated) items = [...items, revoked];
  if (q) {
    items = items.filter(
      (item) => item.id.toLowerCase().includes(q) || item.name.toLowerCase().includes(q),
    );
  }
  if (tactic) items = items.filter((item) => item.tactics.includes(tactic));
  const filtered = q.length > 0 || tactic.length > 0 || !includeSubtechniques || includeDeprecated;
  if (!filtered && page > 1) {
    return jsonResponse({ page, page_size: 25, total: 30, items: [credential] });
  }
  return jsonResponse({
    page,
    page_size: 25,
    total: filtered ? items.length : 30,
    items: filtered ? items : [parent, child],
  });
}

function installReader(options?: { status?: number; expireOnAttack?: boolean }) {
  const user = {
    ...currentUserFixture,
    permissions: [...currentUserFixture.permissions, "threat_intel.read"],
  };
  let expired = false;
  return installApiFetch(
    (url) => {
      if (url.includes("/api/v1/auth/session") || url.includes("/api/v1/auth/me")) {
        if (expired) return jsonResponse(anonymousSessionFixture);
        return jsonResponse(
          url.includes("/auth/me") ? user : { ...authenticatedSessionFixture, user },
        );
      }
      if (url.includes("/api/v1/attack")) {
        if (options?.expireOnAttack) {
          expired = true;
          return jsonResponse({ message: "Authentication is required." }, 401);
        }
        if (options?.status) {
          return jsonResponse({ message: "traceback: secret catalog" }, options.status);
        }
        return catalogResponse(url);
      }
      return undefined;
    },
    { allowAuthOverride: true },
  );
}

async function openAttack() {
  const user = userEvent.setup();
  await renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
  await user.click(await screen.findByRole("tab", { name: "MITRE ATT&CK" }));
  const explorer = await screen.findByTestId("attack-explorer");
  return { user, explorer };
}

describe("MITRE ATT&CK explorer", () => {
  it("hides the catalog tab without threat_intel.read and keeps indicators", async () => {
    const api = installApiFetch();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    expect(await screen.findByText("IOC-0002")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "MITRE ATT&CK" })).not.toBeInTheDocument();
    expect(api.calls.some((url) => url.includes("/api/v1/attack"))).toBe(false);
  });

  it("renders tactics, techniques, release, and pagination from the API", async () => {
    const api = installReader();
    const { user, explorer } = await openAttack();
    expect(explorer).toHaveTextContent("Pinned Enterprise ATT&CK 20.0");
    expect(explorer).toHaveTextContent("Enterprise technique catalog");
    expect(screen.getByRole("option", { name: "Execution · TA0002" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Persistence · TA0003" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Credential Access/ })).not.toBeInTheDocument();
    expect(explorer).toHaveTextContent("T1059");
    expect(explorer).toHaveTextContent("T1059.001");
    expect(explorer).toHaveTextContent("Command and Scripting Interpreter");
    expect(explorer).toHaveTextContent("execution, persistence");
    expect(explorer).toHaveTextContent("PowerShell");
    expect(explorer).toHaveTextContent("Sub-technique");
    expect(
      api.calls.some(
        (url) =>
          url.includes("include_subtechniques=true") && url.includes("include_deprecated=false"),
      ),
    ).toBe(true);
    expect(within(explorer).getByTestId("attack-pager-status")).toHaveTextContent("Page 1 of 2");

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => {
      expect(
        api.calls.some(
          (url) => url.includes("/api/v1/attack/techniques?") && url.includes("page=2"),
        ),
      ).toBe(true);
    });
    expect(await within(explorer).findAllByText("OS Credential Dumping")).not.toHaveLength(0);
  });

  it("searches by id and name, filters by tactic, and resets the page", async () => {
    const api = installReader();
    const { user, explorer } = await openAttack();
    expect(explorer).toHaveTextContent("Command and Scripting Interpreter");
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => {
      expect(api.calls.some((url) => url.includes("page=2"))).toBe(true);
    });

    await user.type(screen.getByRole("searchbox", { name: /search att&ck id or name/i }), "T1059");
    await waitFor(() => {
      expect(api.calls.some((url) => url.includes("q=T1059") && url.includes("page=1"))).toBe(true);
    });
    expect(explorer).toHaveTextContent("PowerShell");

    await user.clear(screen.getByRole("searchbox", { name: /search att&ck id or name/i }));
    await user.type(
      screen.getByRole("searchbox", { name: /search att&ck id or name/i }),
      "PowerShell",
    );
    await waitFor(() => {
      expect(api.calls.some((url) => url.includes("q=PowerShell"))).toBe(true);
    });

    await user.clear(screen.getByRole("searchbox", { name: /search att&ck id or name/i }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Tactic" }), "execution");
    await waitFor(() => {
      expect(
        api.calls.some((url) => url.includes("tactic=execution") && url.includes("page=1")),
      ).toBe(true);
    });
    expect(
      api.calls.some((url) => url.includes("tactic=execution") && url.includes("page=2")),
    ).toBe(false);

    await user.selectOptions(screen.getByRole("combobox", { name: "Tactic" }), "All tactics");
    await waitFor(() => {
      expect(
        api.calls.some((url) => {
          if (!url.includes("/api/v1/attack/techniques?")) return false;
          const params = new URL(url, "http://localhost").searchParams;
          return params.get("page") === "1" && !params.has("tactic");
        }),
      ).toBe(true);
    });
  });

  it("toggles sub-techniques and labels revoked or deprecated records", async () => {
    const api = installReader();
    const { user, explorer } = await openAttack();
    expect(explorer).toHaveTextContent("PowerShell");
    await user.click(screen.getByRole("checkbox", { name: "Show sub-techniques" }));
    await waitFor(() => {
      expect(api.calls.some((url) => url.includes("include_subtechniques=false"))).toBe(true);
    });
    expect(explorer).not.toHaveTextContent("PowerShell");

    await user.click(screen.getByRole("checkbox", { name: "Show sub-techniques" }));
    await user.click(screen.getByRole("checkbox", { name: "Show deprecated / revoked" }));
    await waitFor(() => {
      expect(api.calls.some((url) => url.includes("include_deprecated=true"))).toBe(true);
    });
    await user.click(within(explorer).getAllByRole("button", { name: /T9999/ })[0]);
    const detailPanel = await within(explorer).findByTestId("attack-detail");
    expect(detailPanel).toHaveTextContent("Revoked");
    expect(detailPanel).toHaveTextContent("Retired technique.");

    await user.click(within(explorer).getAllByRole("button", { name: /T1059\.001/ })[0]);
    expect(await within(explorer).findByText("Deprecated")).toBeInTheDocument();
    expect(explorer).toHaveTextContent("Sub-technique");
    expect(explorer).toHaveTextContent("Parent: T1059 — Command and Scripting Interpreter");
  });

  it("shows technique detail as text and omits internal ids", async () => {
    installReader();
    const { explorer } = await openAttack();
    const detailPanel = await within(explorer).findByTestId("attack-detail");
    expect(detailPanel).toHaveTextContent("T1059");
    expect(detailPanel).toHaveTextContent("Command and Scripting Interpreter");
    expect(detailPanel).toHaveTextContent("Execution · execution · TA0002");
    expect(detailPanel).toHaveTextContent("Persistence · persistence · TA0003");
    expect(detailPanel).toHaveTextContent("Windows, Linux");
    expect(detailPanel).toHaveTextContent("Pinned Enterprise ATT&CK 20.0");
    expect(detailPanel).toHaveTextContent("Not revoked or deprecated");
    expect(detailPanel).toHaveTextContent("2024");
    expect(detailPanel).toHaveTextContent('<script>alert("xss")</script>');
    expect(detailPanel.querySelector("script")).toBeNull();
    expect(detailPanel.querySelector("img")).toBeNull();
    expect(explorer.textContent).not.toContain(hiddenUuid);
    expect(explorer.textContent).not.toContain("https://");
    expect(explorer.textContent).not.toContain("stix");
  });

  it("shows an empty filter result and a missing technique", async () => {
    installReader();
    const { user, explorer } = await openAttack();
    await user.type(screen.getByRole("searchbox", { name: /search att&ck id or name/i }), "zzzz");
    expect(
      await within(explorer).findByText("No ATT&CK techniques match these filters."),
    ).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: /search att&ck id or name/i }));
    await user.type(screen.getByRole("searchbox", { name: /search att&ck id or name/i }), "T0000");
    const missing = await within(explorer).findAllByRole("button", { name: /T0000/ });
    await user.click(missing[0]);
    expect(await within(explorer).findByText("Technique not found")).toBeInTheDocument();
    expect(explorer.textContent).not.toContain("traceback");
  });

  it("shows a catalog failure without a backend trace", async () => {
    installReader({ status: 500 });
    const failed = await openAttack();
    expect(
      await within(failed.explorer).findByText("Unable to load the ATT&CK catalog"),
    ).toBeInTheDocument();
    expect(failed.explorer.textContent).not.toContain("traceback");
  });

  it("shows permission and catalog errors without backend traces", async () => {
    installReader({ status: 403 });
    const forbidden = await openAttack();
    expect(
      await within(forbidden.explorer).findByText("ATT&CK catalog restricted"),
    ).toBeInTheDocument();
    expect(forbidden.explorer).toHaveTextContent(
      "You do not have permission to read the ATT&CK catalog.",
    );
    expect(forbidden.explorer.textContent).not.toContain("traceback");
  });

  it("returns to sign-in when the catalog responds 401", async () => {
    installReader({ expireOnAttack: true });
    const user = userEvent.setup();
    await renderWithProviders(<AppRouter />, { initialEntries: ["/threat-intelligence"] });
    await user.click(await screen.findByRole("tab", { name: "MITRE ATT&CK" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("keeps indicators, advisories, and sources available beside the catalog", async () => {
    installReader();
    const { user } = await openAttack();
    expect(screen.getByTestId("attack-explorer")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Indicators" }));
    expect(await screen.findByText("IOC-0002")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Advisories" }));
    expect(await screen.findByTestId("intel-advisories")).toHaveTextContent("ADV-0001");
    await user.click(screen.getByRole("tab", { name: "Sources" }));
    expect(await screen.findByTestId("intel-sources")).toHaveTextContent("SRC-0001");
  });
});
