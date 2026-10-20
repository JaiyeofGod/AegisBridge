import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Sidebar } from "@/components/navigation/Sidebar";
import { renderWithProviders } from "@/test/render";

describe("Sidebar", () => {
  it("marks unimplemented modules without navigation", () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Governance & Compliance")).toBeInTheDocument();
    expect(screen.getAllByText("Soon").length).toBeGreaterThan(0);
    const overview = screen.getByRole("link", { name: "Overview" });
    expect(overview).toHaveAttribute("href", "/overview");
  });
});
