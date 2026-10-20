import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-[var(--text)]">
          {title}
        </h1>
        {description ? <p className="mt-2 text-sm text-[var(--muted)]">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
