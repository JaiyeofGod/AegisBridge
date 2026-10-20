import { cn } from "@/lib/cn";

export function LoadingState({
  label = "Updating",
  className,
  rows = 3,
}: {
  label?: string;
  className?: string;
  rows?: number;
}) {
  return (
    <div className={cn("space-y-3", className)} role="status" aria-live="polite" aria-busy="true">
      <p className="text-sm font-medium text-[var(--muted)]">{label}…</p>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-12 animate-pulse rounded-[var(--radius-control)] bg-[var(--raised)]"
        />
      ))}
    </div>
  );
}
