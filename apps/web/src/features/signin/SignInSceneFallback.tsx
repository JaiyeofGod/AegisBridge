/**
 * Static fallback for the Sign-in brand scene.
 * Used while loading, on failure, for reduced motion, and on compact viewports.
 */
export function SignInSceneFallback() {
  return (
    <div
      className="relative h-full min-h-[240px] w-full overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-[radial-gradient(90%_70%_at_50%_40%,#1b3344_0%,#121a24_55%,#0c1118_100%)]"
      data-testid="signin-scene-fallback"
      aria-hidden
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(rgba(103,223,229,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(103,223,229,0.07) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute inset-x-[12%] bottom-[18%] top-[22%] rounded-[40%] border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]" />
      <div className="absolute top-[28%] left-[18%] size-16 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--raised)] opacity-90" />
      <div className="absolute top-[34%] right-[20%] size-14 rounded-full border border-[var(--border)] bg-[var(--surface)] opacity-90" />
      <div className="absolute right-[28%] bottom-[26%] h-12 w-20 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] opacity-90" />
    </div>
  );
}
