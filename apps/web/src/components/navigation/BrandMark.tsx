import { Link } from "react-router-dom";

import { cn } from "@/lib/cn";

export function BrandMark({ className, to = "/overview" }: { className?: string; to?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-1",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
        className,
      )}
      aria-label="AegisBridge home"
    >
      <span
        className="flex size-9 items-center justify-center rounded-[10px] bg-[var(--accent)] text-[var(--ink)]"
        aria-hidden
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3 4 7v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V7l-8-4Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M8.5 12.5 11 15l4.5-5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </span>
      <span className="font-heading text-base font-bold tracking-tight text-[var(--text)]">
        AegisBridge
      </span>
    </Link>
  );
}
