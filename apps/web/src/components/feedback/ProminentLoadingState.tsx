export function ProminentLoadingState({ label = "Checking session" }: { label?: string }) {
  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="prominent-loading"
    >
      <div className="flex flex-col items-center gap-4">
        <span className="motion-workspace-loader" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <p className="text-sm font-medium text-[var(--muted)]">{label}…</p>
      </div>
    </div>
  );
}
