import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { AppShell } from "@/components/navigation/AppShell";
import motionCss from "@/styles/index.css?raw";
import { renderWithProviders } from "@/test/render";

describe("AppShell navigation drawer", () => {
  afterEach(() => {
    delete document.documentElement.dataset.motion;
  });

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
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("returns focus to Open navigation when Escape closes the drawer", async () => {
    const user = userEvent.setup();
    await renderWithProviders(
      <AppShell>
        <p>Workspace</p>
      </AppShell>,
    );

    const opener = screen.getByRole("button", { name: "Open navigation" });
    await user.click(opener);
    expect(
      screen.getByRole("dialog", { name: "Navigation" }).contains(document.activeElement),
    ).toBe(true);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("returns focus to Open navigation when reduced motion is requested", async () => {
    document.documentElement.dataset.motion = "reduce";
    const user = userEvent.setup();
    await renderWithProviders(
      <AppShell>
        <p>Workspace</p>
      </AppShell>,
    );

    const opener = screen.getByRole("button", { name: "Open navigation" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    expect(dialog).toHaveClass("motion-drawer");
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("keeps drawer motion on the shared reduced-motion rule", () => {
    const reducedStart = motionCss.indexOf("@media (prefers-reduced-motion: reduce)");
    const reduced = motionCss.slice(reducedStart, motionCss.indexOf("@layer utilities"));
    const drawer = motionCss.slice(motionCss.indexOf(".motion-drawer {"));

    expect(reduced).toContain("animation-duration: 0.01ms !important");
    expect(reduced).not.toContain(".motion-drawer");
    expect(drawer).toContain("animation-name: motion-drawer-in");
    expect(drawer).toContain("animation-name: motion-drawer-out");
  });
});
