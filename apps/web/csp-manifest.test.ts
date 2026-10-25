import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const renderManifest = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../render.yaml",
);

describe("deployable frontend headers", () => {
  it("does not ship a placeholder API origin or a wildcard script source", () => {
    const manifest = readFileSync(renderManifest, "utf8");

    expect(manifest).not.toContain("api.example");
    expect(manifest).not.toContain("connect-src");
    expect(manifest).not.toMatch(/script-src\s+\*/);
    expect(manifest).not.toContain("'unsafe-eval'");
    expect(manifest).not.toMatch(/name:\s*Content-Security-Policy/);
  });
});
