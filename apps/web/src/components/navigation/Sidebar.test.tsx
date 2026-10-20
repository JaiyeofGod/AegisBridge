import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Sidebar } from "@/components/navigation/Sidebar";
import { renderWithProviders } from "@/test/render";

describe("Sidebar", () => {
  it("links every primary module, including administration", () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/overview");
    expect(screen.getByRole("link", { name: "Administration" })).toHaveAttribute(
      "href",
      "/administration",
    );
    expect(screen.queryByText("Soon")).not.toBeInTheDocument();
  });
});
