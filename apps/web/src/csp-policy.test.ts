import { describe, expect, it } from "vitest";

import { frontendContentSecurityPolicy } from "@/csp-policy";

describe("frontend content security policy", () => {
  it("connects only to the configured https origin, the font hosts, and the Draco decoder host", () => {
    const policy = frontendContentSecurityPolicy("https://signals.internal/v1");

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(policy).toContain(
      "connect-src 'self' https://signals.internal https://fonts.googleapis.com https://fonts.gstatic.com https://www.gstatic.com",
    );
    expect(policy).not.toMatch(/connect-src[^;]*\*/);
    expect(policy).toContain("https://fonts.googleapis.com");
    expect(policy).toContain("https://fonts.gstatic.com");
    expect(policy).not.toContain("script-src 'self' 'wasm-unsafe-eval' https://www.gstatic.com");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("*");
    expect(policy).not.toContain("/v1");
  });

  it("rejects credentials, http, and wildcard hosts", () => {
    expect(() => frontendContentSecurityPolicy("https://user:secret@signals.internal")).toThrow(
      /credentials/,
    );
    expect(() => frontendContentSecurityPolicy("http://signals.internal")).toThrow(/https/);
    expect(() => frontendContentSecurityPolicy("https://*.internal")).toThrow(/wildcard/);
  });
});
