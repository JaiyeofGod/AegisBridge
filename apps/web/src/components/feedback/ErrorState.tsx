import { Button } from "@/components/buttons/Button";
import { formatTimestamp } from "@/lib/format";

export function ErrorState({
  title = "Unable to load data",
  description,
  onRetry,
  lastSuccessfulAt,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  lastSuccessfulAt?: string;
}) {
  return (
    <div
      className="rounded-[var(--radius-panel)] border border-[var(--critical)] bg-[color-mix(in_srgb,var(--critical)_8%,transparent)] p-4"
      role="alert"
    >
      <h3 className="font-heading text-base text-[var(--critical)]">{title}</h3>
      {description ? <p className="mt-2 text-sm text-[var(--text)]">{description}</p> : null}
      {lastSuccessfulAt ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          Last successful update: {formatTimestamp(lastSuccessfulAt)}
        </p>
      ) : null}
      {onRetry ? (
        <div className="mt-4">
          <Button type="button" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}
