import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/buttons/Button";

describe("Button motion", () => {
  it("keeps the shared fast transition without removing disabled or variant behavior", () => {
    const { rerender } = render(<Button variant="danger">Delete</Button>);
    const button = screen.getByRole("button", { name: "Delete" });

    expect(button).toHaveClass("motion-control");
    expect(button.className).toContain("bg-[var(--critical)]");
    expect(button).toBeEnabled();

    rerender(
      <Button variant="secondary" disabled>
        Delete
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});
