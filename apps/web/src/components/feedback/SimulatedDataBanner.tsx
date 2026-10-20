export function SimulatedDataBanner({
  message = "Simulated demo data — not verified operational results",
}: {
  message?: string;
}) {
  return (
    <div
      className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--warning)]"
      role="note"
      data-testid="simulated-data-banner"
    >
      {message}
    </div>
  );
}
