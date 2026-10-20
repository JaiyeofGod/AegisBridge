/**
 * Static fallback for the Sign-in brand scene.
 * Borderless so it blends with the left panel (no card chrome).
 */
export function SignInSceneFallback() {
  return (
    <div
      className="relative h-full min-h-[240px] w-full overflow-hidden bg-transparent"
      data-testid="signin-scene-fallback"
      aria-hidden
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(103,223,229,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(103,223,229,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute inset-x-[10%] bottom-[14%] top-[18%] rounded-[42%] border border-[color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]" />
      <div className="absolute top-[26%] left-[16%] size-16 rounded-[var(--radius-panel)] border border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--raised)_80%,transparent)]" />
      <div className="absolute top-[32%] right-[18%] size-14 rounded-full border border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--surface)_75%,transparent)]" />
      <div className="absolute right-[26%] bottom-[22%] h-12 w-20 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--raised)_80%,transparent)]" />
    </div>
  );
}
