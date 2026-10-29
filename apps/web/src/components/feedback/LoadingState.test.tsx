import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingState } from "@/components/feedback/LoadingState";

describe("LoadingState", () => {
  it("keeps the skeleton readable, stable, and the same height", () => {
    const { container } = render(<LoadingState label="Updating" rows={3} />);
    const status = screen.getByRole("status");

    expect(status).toHaveTextContent("Updating…");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveAttribute("aria-live", "polite");

    const bars = container.querySelectorAll("div.h-12");
    expect(bars).toHaveLength(3);
    for (const bar of bars) {
      expect(bar).toHaveClass("h-12", "bg-[var(--raised)]");
      expect(bar).not.toHaveClass("animate-pulse");
      expect(bar.className).not.toMatch(/animate|shimmer|motion-/);
    }
  });
});
