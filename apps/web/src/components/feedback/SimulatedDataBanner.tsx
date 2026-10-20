export function SimulatedDataBanner({
  message = "Simulated demo data — not verified operational results",
}: {
  message?: string;
}) {
  return (
    <div
      className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-3 py-1.5 text-[11px] font-medium tracking-[0.06em] text-[var(--warning)] uppercase"
      role="note"
      data-testid="simulated-data-banner"
    >
      {message}
    </div>
  );
}
