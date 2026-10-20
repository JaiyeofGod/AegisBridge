import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function Input({ id, label, hint, error, className, ...props }: InputProps) {
  const inputId = id ?? props.name ?? label.replace(/\s+/g, "-").toLowerCase();
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  const labelId = `${inputId}-label`;

  return (
    <div className="flex w-full flex-col gap-2">
      <label id={labelId} className="text-sm font-medium text-[var(--text)]" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={cn(
          "min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)]",
          "bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
          error && "border-[var(--critical)]",
          className,
        )}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        aria-labelledby={labelId}
        {...props}
      />
      {hint && !error ? (
        <span id={`${inputId}-hint`} className="text-xs text-[var(--muted)]">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${inputId}-error`} className="text-xs text-[var(--critical)]" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
