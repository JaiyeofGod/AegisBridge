import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SignInSplineScene } from "@/features/signin/SignInSplineScene";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Sign-in Spline scene", () => {
  it("keeps static artwork visible until the live canvas is ready", async () => {
    render(<SignInSplineScene />);

    const scene = screen.getByTestId("signin-spline-scene");
    expect(scene).toHaveAttribute("data-scene-status", "loading");
    const fallback = within(scene).getByTestId("signin-scene-fallback");
    expect(fallback.parentElement).toHaveClass("duration-500", "opacity-100");
    expect(scene.querySelector(".duration-700")).toHaveClass("opacity-0");
    expect(within(scene).getByRole("status")).toHaveTextContent("Loading brand scene");

    await waitFor(() => expect(scene).toHaveAttribute("data-scene-status", "ready"));
    expect(fallback.parentElement).toHaveClass("duration-500", "opacity-0", "pointer-events-none");
    expect(scene.querySelector(".duration-700")).toHaveClass("duration-700", "opacity-100");
    expect(within(scene).queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps the live canvas when a post-load adjustment throws", async () => {
    globalThis.__aegisSplineMock = "load-adjustment-throws";
    render(<SignInSplineScene />);

    const scene = screen.getByTestId("signin-spline-scene");
    await waitFor(() => expect(scene).toHaveAttribute("data-scene-status", "ready"));
    expect(within(scene).getByTestId("signin-scene-fallback")).toBeInTheDocument();
    expect(scene.querySelector(".duration-700")).toBeInTheDocument();
  });

  it("keeps static artwork when the live scene fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    globalThis.__aegisSplineMock = "error";
    render(<SignInSplineScene />);

    const scene = await screen.findByTestId("signin-spline-scene");
    await waitFor(() => expect(scene).toHaveAttribute("data-scene-status", "error"));
    expect(within(scene).getByTestId("signin-scene-fallback")).toBeInTheDocument();
    expect(fallbackLayer(scene)).toHaveClass("opacity-100");
    expect(scene.querySelector(".duration-700")).not.toBeInTheDocument();
    expect(within(scene).queryByRole("status")).not.toBeInTheDocument();
  });
});

function fallbackLayer(scene: HTMLElement) {
  const fallback = within(scene).getByTestId("signin-scene-fallback");
  const layer = fallback.parentElement;
  if (!layer) {
    throw new Error("Static fallback layer is missing");
  }
  return layer;
}
