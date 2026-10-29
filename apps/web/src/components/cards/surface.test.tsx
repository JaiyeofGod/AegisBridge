import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Panel } from "@/components/cards/Panel";
import { SummaryMetric } from "@/components/cards/SummaryMetric";
import type { OverviewMetric } from "@/types/overview";

const criticalMetric: OverviewMetric = {
  id: "open-critical",
  label: "Open critical findings",
  primaryValue: "3",
  secondaryLabel: "stored records",
  secondaryValue: "3",
  tone: "critical",
  freshness: "fresh",
  semantics: "Count of stored critical findings. Not a security score.",
};

describe("Surface treatment", () => {
  it("gives static panels depth without a click affordance", () => {
    render(
      <Panel title="Security highlights" description="Stored notes.">
        <p>No open investigation is implied.</p>
      </Panel>,
    );

    const panel = screen.getByRole("heading", { name: "Security highlights" }).closest("section");
    if (!panel) {
      throw new Error("Security highlights panel is missing");
    }
    expect(panel).toHaveClass("motion-surface", "bg-[var(--surface)]");
    expect(panel).not.toHaveClass("motion-surface-interactive");
  });

  it("keeps metric cards informational and preserves status borders", () => {
    render(<SummaryMetric metric={criticalMetric} />);

    const card = screen.getByRole("article", { name: /open critical findings: 3/i });
    expect(card).toHaveClass("motion-surface");
    expect(card).not.toHaveClass("motion-surface-interactive");
    expect(card.className).toContain("var(--critical)");
    expect(card).toHaveAccessibleName("Open critical findings: 3");
  });
});
