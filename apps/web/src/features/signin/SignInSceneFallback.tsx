/**
 * Static fallback for the Sign-in brand scene.
 * Fills the floating visual card when live Spline is unavailable.
 */
export function SignInSceneFallback() {
  return (
    <div
      className="relative h-full w-full overflow-hidden bg-transparent"
      data-testid="signin-scene-fallback"
      aria-hidden
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(103,223,229,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(103,223,229,0.06) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="absolute inset-[14%] rounded-[38%] border border-[color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]" />
      <div className="absolute top-[22%] left-[18%] size-11 rounded-[var(--radius-panel)] border border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--raised)_80%,transparent)]" />
      <div className="absolute top-[28%] right-[16%] size-10 rounded-full border border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--surface)_75%,transparent)]" />
      <div className="absolute right-[22%] bottom-[18%] h-9 w-14 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--raised)_80%,transparent)]" />
    </div>
  );
}
