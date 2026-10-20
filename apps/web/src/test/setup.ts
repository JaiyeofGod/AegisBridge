import "@testing-library/jest-dom/vitest";
import { configure, cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

configure({ asyncUtilTimeout: 10_000 });

afterEach(() => {
  cleanup();
});

// jsdom has no WebGL; keep Sign-in tests focused on layout/auth chrome.
vi.mock("@splinetool/react-spline", () => ({
  default: function MockSpline({
    onLoad,
  }: {
    onLoad?: (app: { setBackgroundColor: (color: string) => void }) => void;
  }) {
    if (onLoad) {
      queueMicrotask(() => {
        onLoad({ setBackgroundColor: () => undefined });
      });
    }
    return null;
  },
}));
