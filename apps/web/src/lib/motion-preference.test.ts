import { describe, expect, it } from "vitest";

import indexHtml from "../../index.html?raw";
import {
  MOTION_PREFERENCE_KEY,
  applyMotionDocumentState,
  getMotionPreference,
  prefersReducedMotion,
  readMotionPreference,
  setMotionPreference,
} from "@/lib/motion-preference";

describe("motion preference", () => {
  it("follows the system unless the stored choice is reduce", () => {
    expect(readMotionPreference(null)).toBe("system");
    expect(readMotionPreference("system")).toBe("system");
    expect(readMotionPreference("reduce")).toBe("reduce");
    expect(readMotionPreference("always")).toBe("system");
    expect(readMotionPreference("")).toBe("system");
    expect(prefersReducedMotion("system", false)).toBe(false);
    expect(prefersReducedMotion("system", true)).toBe(true);
    expect(prefersReducedMotion("reduce", false)).toBe(true);
    expect(prefersReducedMotion("reduce", true)).toBe(true);
  });

  it("persists a valid choice and ignores a corrupted stored value", () => {
    localStorage.removeItem(MOTION_PREFERENCE_KEY);
    expect(getMotionPreference()).toBe("system");

    setMotionPreference("reduce");
    expect(localStorage.getItem(MOTION_PREFERENCE_KEY)).toBe("reduce");
    expect(getMotionPreference()).toBe("reduce");

    localStorage.setItem(MOTION_PREFERENCE_KEY, "{");
    expect(getMotionPreference()).toBe("system");
    localStorage.removeItem(MOTION_PREFERENCE_KEY);
  });

  it("marks the document reduced when the user or the operating system asks for it", () => {
    applyMotionDocumentState("system", false);
    expect(document.documentElement.dataset.motion).toBe("system");
    applyMotionDocumentState("system", true);
    expect(document.documentElement.dataset.motion).toBe("reduce");
    applyMotionDocumentState("reduce", false);
    expect(document.documentElement.dataset.motion).toBe("reduce");
    delete document.documentElement.dataset.motion;
  });

  it("bootstraps the same storage key before the app renders", () => {
    expect(indexHtml).toContain(MOTION_PREFERENCE_KEY);
    expect(indexHtml).toContain('stored === "reduce"');
    expect(indexHtml).toContain('"(prefers-reduced-motion: reduce)"');
  });
});
