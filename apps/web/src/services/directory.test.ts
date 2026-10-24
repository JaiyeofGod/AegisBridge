import { describe, expect, it } from "vitest";

import { fetchDirectoryUsers } from "@/services/directory";
import { installApiFetch, jsonResponse } from "@/test/api-fixtures";

describe("operational directory client", () => {
  it("sends page, page_size, and q with credentials and without CSRF", async () => {
    const api = installApiFetch((url) => {
      if (!url.includes("/api/v1/directory/users")) return undefined;
      return jsonResponse({
        page: 2,
        page_size: 20,
        total: 1,
        items: [
          {
            id: "USR-0004",
            display_name: "Jonah Hale",
            account_status: "active",
            department: "Security",
            job_title: "SOC analyst",
          },
        ],
      });
    });

    const page = await fetchDirectoryUsers({ page: 2, pageSize: 20, q: " Jonah " });
    expect(Object.keys(page.items[0] ?? {}).sort()).toEqual([
      "account_status",
      "department",
      "display_name",
      "id",
      "job_title",
    ]);
    expect(page.items[0]).not.toHaveProperty("email");
    expect(page.items[0]).not.toHaveProperty("roles");
    expect(page.items[0]).not.toHaveProperty("permissions");

    const index = api.calls.findIndex((url) => url.includes("/api/v1/directory/users"));
    const url = api.calls[index] ?? "";
    expect(url).toContain("/api/v1/directory/users?");
    expect(url).toContain("page=2");
    expect(url).toContain("page_size=20");
    expect(url).toContain("q=Jonah");
    expect(url).not.toContain("/api/v1/administration/users");
    expect(api.credentialFlags[index]).toBe("include");
    expect(api.inits[index]?.method ?? "GET").toBe("GET");
    expect((api.inits[index]?.headers as Headers).get("X-CSRF-Token")).toBeNull();
    expect(api.calls.some((call) => call.includes("/api/v1/administration/users"))).toBe(false);
  });
});
