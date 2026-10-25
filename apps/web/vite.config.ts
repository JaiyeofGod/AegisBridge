import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

import { frontendContentSecurityPolicy } from "./src/csp-policy.ts";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function assertPublicApiUrl(): void {
  if (process.env.AEGIS_REQUIRE_PUBLIC_API !== "1") return;
  const configured = process.env.VITE_API_BASE_URL ?? "";
  let hostname = "";
  let protocol = "";
  try {
    const url = new URL(configured);
    hostname = url.hostname;
    protocol = url.protocol;
  } catch {
    hostname = "";
  }
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  if (protocol !== "https:" || local) {
    throw new Error(
      "Set VITE_API_BASE_URL to the public https API origin before this production build.",
    );
  }
}

assertPublicApiUrl();

function productionCspPlugin(): Plugin {
  const enabled = process.env.AEGIS_REQUIRE_PUBLIC_API === "1";
  const policy = enabled ? frontendContentSecurityPolicy(process.env.VITE_API_BASE_URL ?? "") : "";
  return {
    name: "aegis-production-csp",
    transformIndexHtml(html) {
      if (!policy) return html;
      const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}" />`;
      return html.replace("<head>", `<head>\n    ${meta}`);
    },
    closeBundle() {
      if (!policy) return;
      writeFileSync(path.resolve(rootDir, "dist/content-security-policy.txt"), `${policy}\n`);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), productionCspPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    restoreMocks: true,
    testTimeout: 20_000,
  },
});
