import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/buttons/Button";

describe("Button motion", () => {
  it("keeps the shared fast transition without removing disabled or variant behavior", () => {
    const { rerender } = render(<Button variant="danger">Delete</Button>);
    const button = screen.getByRole("button", { name: "Delete" });

    expect(button).toHaveClass("motion-control", "motion-glass-danger");
    expect(button.className).toContain("bg-[var(--critical)]");
    expect(button.className).not.toContain("motion-glass-primary");
    expect(button).toBeEnabled();

    rerender(
      <Button variant="secondary" disabled>
        Delete
      </Button>,
    );
    const disabled = screen.getByRole("button", { name: "Delete" });
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveClass(
      "motion-glass-secondary",
      "disabled:pointer-events-none",
      "disabled:opacity-50",
    );
  });

  it("keeps a cyan focus ring and a distinct treatment for each variant", () => {
    const { rerender } = render(<Button>Continue</Button>);
    const primary = screen.getByRole("button", { name: "Continue" });
    expect(primary).toHaveClass(
      "motion-glass-primary",
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
      "focus-visible:outline-[var(--accent)]",
    );
    expect(primary.className).not.toContain("backdrop-blur");

    rerender(<Button variant="secondary">Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("motion-glass-secondary");

    rerender(<Button variant="ghost">Sign out</Button>);
    const ghost = screen.getByRole("button", { name: "Sign out" });
    expect(ghost).toHaveClass("motion-glass-ghost", "bg-transparent");
    expect(ghost).not.toHaveClass("motion-glass-primary");
  });
});
