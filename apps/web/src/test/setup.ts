import "@testing-library/jest-dom/vitest";
import { configure, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { clearCsrfToken } from "@/services/csrf";
import { installApiFetch } from "@/test/api-fixtures";

configure({ asyncUtilTimeout: 10_000 });

beforeEach(() => {
  clearCsrfToken();
  installApiFetch();
});

afterEach(() => {
  cleanup();
  clearCsrfToken();
  vi.unstubAllGlobals();
  delete globalThis.__aegisSplineMock;
});

type SplineMockMode = "ready" | "error" | "load-adjustment-throws";

declare global {
  var __aegisSplineMock: SplineMockMode | undefined;
}

// jsdom has no WebGL; keep Sign-in tests focused on layout/auth chrome.
vi.mock("@splinetool/react-spline", () => ({
  default: function MockSpline({
    onLoad,
  }: {
    onLoad?: (app: {
      setBackgroundColor: (color: string) => void;
      canvas: HTMLCanvasElement;
    }) => void;
  }) {
    const mode = globalThis.__aegisSplineMock ?? "ready";
    if (mode === "error") {
      throw new Error("Spline scene failed to load");
    }
    if (onLoad) {
      queueMicrotask(() => {
        const canvas = document.createElement("canvas");
        const parent = document.createElement("div");
        parent.appendChild(canvas);
        onLoad({
          setBackgroundColor: () => {
            if (globalThis.__aegisSplineMock === "load-adjustment-throws") {
              throw new Error("background adjustment failed");
            }
          },
          canvas,
        });
      });
    }
    return null;
  },
}));
