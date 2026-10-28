import { describe, expect, it } from "vitest";

import tokensCss from "@/styles/tokens.css?raw";

import { motionDuration, motionReducedDuration, motionVars } from "@/lib/motion";

describe("motion tokens", () => {
  it("records the shared phase 1 timing and easing values", () => {
    expect(tokensCss).toContain("--motion-duration-fast: 150ms;");
    expect(tokensCss).toContain("--motion-duration-standard: 200ms;");
    expect(tokensCss).toContain("--motion-duration-cinematic: 400ms;");
    expect(tokensCss).toContain("--motion-ease-enter: cubic-bezier(0, 0, 0.2, 1);");
    expect(tokensCss).toContain("--motion-ease-exit: cubic-bezier(0.4, 0, 1, 1);");
    expect(tokensCss).toContain("--motion-distance: 8px;");
    expect(motionVars.durationFast).toBe("var(--motion-duration-fast)");
    expect(motionVars.durationStandard).toBe("var(--motion-duration-standard)");
    expect(motionVars.durationCinematic).toBe("var(--motion-duration-cinematic)");
    expect(motionVars.easeEnter).toBe("var(--motion-ease-enter)");
    expect(motionVars.easeExit).toBe("var(--motion-ease-exit)");
    expect(motionVars.distance).toBe("var(--motion-distance)");
  });

  it("collapses a duration when reduced motion is requested", () => {
    expect(motionDuration(motionVars.durationCinematic, true)).toBe(motionReducedDuration);
    expect(motionDuration(motionVars.durationFast, false)).toBe(motionVars.durationFast);
  });
});
