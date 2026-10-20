import type { ReactNode } from "react";

/** Read-only account field: muted label, value, optional hint. */
export function AccountField({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value?: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-[var(--border)] py-4 last:border-b-0">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      {children ? <div className="mt-2">{children}</div> : null}
      {value ? <div className="mt-1 text-sm text-[var(--text)]">{value}</div> : null}
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}
