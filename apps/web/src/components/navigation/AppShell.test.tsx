import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/navigation/AppShell";
import { renderWithProviders } from "@/test/render";

describe("AppShell navigation drawer", () => {
  it("opens the existing dialog from the correct edge without replacing its name", async () => {
    const user = userEvent.setup();
    await renderWithProviders(
      <AppShell>
        <p>Workspace</p>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    expect(dialog).toHaveClass("motion-drawer");
    expect(dialog).toHaveClass("left-0");
    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument();
  });
});
