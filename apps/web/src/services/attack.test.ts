import { describe, expect, it } from "vitest";

import { fetchAttackTactics, fetchAttackTechnique, fetchAttackTechniques } from "@/services/attack";
import { installApiFetch, jsonResponse } from "@/test/api-fixtures";

const tactic = {
  id: "TA0002",
  name: "Execution",
  short_name: "execution",
  release: "20.0",
};

describe("ATT&CK catalog client", () => {
  it("requests tactics with credentials and without a CSRF header", async () => {
    const api = installApiFetch((url) => {
      if (!url.includes("/api/v1/attack/tactics")) return undefined;
      return jsonResponse([tactic]);
    });

    const rows = await fetchAttackTactics();
    expect(rows).toEqual([tactic]);
    const index = api.calls.findIndex((url) => url.includes("/api/v1/attack/tactics"));
    expect(api.calls[index]).toBe("/api/v1/attack/tactics");
    expect(api.credentialFlags[index]).toBe("include");
    expect(api.inits[index]?.method ?? "GET").toBe("GET");
    expect((api.inits[index]?.headers as Headers).get("X-CSRF-Token")).toBeNull();
  });

  it("sends include_deprecated when revoked tactics are requested", async () => {
    const api = installApiFetch((url) => {
      if (!url.includes("/api/v1/attack/tactics")) return undefined;
      return jsonResponse([tactic]);
    });

    await fetchAttackTactics(true);
    expect(
      api.calls.some((url) => url.includes("/api/v1/attack/tactics?include_deprecated=true")),
    ).toBe(true);
  });

  it("sends technique search, tactic, sub-technique, and deprecated parameters", async () => {
    const api = installApiFetch((url) => {
      if (!url.includes("/api/v1/attack/techniques?")) return undefined;
      return jsonResponse({ page: 2, page_size: 25, total: 0, items: [] });
    });

    await fetchAttackTechniques({
      page: 2,
      pageSize: 25,
      q: "T1059",
      tactic: "execution",
      includeSubtechniques: false,
      includeDeprecated: true,
    });
    const url = api.calls.find((call) => call.includes("/api/v1/attack/techniques?")) ?? "";
    expect(url).toContain("page=2");
    expect(url).toContain("page_size=25");
    expect(url).toContain("q=T1059");
    expect(url).toContain("tactic=execution");
    expect(url).toContain("include_subtechniques=false");
    expect(url).toContain("include_deprecated=true");
    const index = api.calls.indexOf(url);
    expect(api.credentialFlags[index]).toBe("include");
    expect((api.inits[index]?.headers as Headers).get("X-CSRF-Token")).toBeNull();
  });

  it("requests one technique by ATT&CK id", async () => {
    const api = installApiFetch((url) => {
      if (!url.includes("/api/v1/attack/techniques/T1059.001")) return undefined;
      return jsonResponse({
        id: "T1059.001",
        name: "PowerShell",
        description: "Commands.",
        tactics: [tactic],
        platforms: ["Windows"],
        is_subtechnique: true,
        parent: { id: "T1059", name: "Command and Scripting Interpreter" },
        revoked: false,
        deprecated: false,
        release: "20.0",
        modified_at: "2024-04-11T00:00:00+00:00",
      });
    });

    const detail = await fetchAttackTechnique("T1059.001");
    expect(detail.id).toBe("T1059.001");
    expect(detail.parent?.id).toBe("T1059");
    expect(api.calls.some((url) => url.endsWith("/api/v1/attack/techniques/T1059.001"))).toBe(true);
    const index = api.calls.findIndex((url) => url.includes("/techniques/T1059.001"));
    expect((api.inits[index]?.headers as Headers).get("X-CSRF-Token")).toBeNull();
  });
});
