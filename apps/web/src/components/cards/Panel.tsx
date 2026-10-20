import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Panel({
  title,
  description,
  action,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6",
        className,
      )}
      {...props}
    >
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="font-heading text-lg text-[var(--text)]">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
