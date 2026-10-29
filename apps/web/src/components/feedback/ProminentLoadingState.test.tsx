import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import motionCss from "@/styles/index.css?raw";
import { ProminentLoadingState } from "@/components/feedback/ProminentLoadingState";

describe("ProminentLoadingState", () => {
  it("renders the session status without skeleton bars", () => {
    const { container } = render(<ProminentLoadingState label="Checking session" />);
    const status = screen.getByRole("status");

    expect(status).toHaveTextContent("Checking session…");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status.querySelector(".motion-workspace-loader")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("div.h-12")).toHaveLength(0);
  });

  it("removes the loader motion when reduced motion is requested", () => {
    const start = motionCss.indexOf("@media (prefers-reduced-motion: reduce)");
    const reduced = motionCss.slice(start, motionCss.indexOf("@layer utilities"));

    expect(reduced).toContain(".motion-workspace-loader span:nth-child(2)");
    expect(reduced).toMatch(/animation:\s*none\s*!important/);
  });
});
