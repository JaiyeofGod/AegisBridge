import { AlertTriangle } from "lucide-react";

import { formatTimestamp } from "@/lib/format";

export function StaleDataIndicator({
  lastSuccessfulAt,
  message = "Data may be stale",
}: {
  lastSuccessfulAt?: string;
  message?: string;
}) {
  return (
    <div
      className="flex items-start gap-2 rounded-[var(--radius-control)] border border-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-3 py-2 text-sm text-[var(--warning)]"
      role="status"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">{message}</p>
        {lastSuccessfulAt ? (
          <p className="text-xs opacity-90">
            Last successful update: {formatTimestamp(lastSuccessfulAt)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
