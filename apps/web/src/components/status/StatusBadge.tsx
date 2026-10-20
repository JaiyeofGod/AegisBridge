import { cn } from "@/lib/cn";

const toneStyles = {
  critical: "bg-[color-mix(in_srgb,var(--critical)_18%,transparent)] text-[var(--critical)]",
  warning: "bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[var(--warning)]",
  success: "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]",
  accent: "bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--accent)]",
  neutral: "bg-[var(--raised)] text-[var(--muted)]",
} as const;

export type StatusBadgeProps = {
  label: string;
  tone?: keyof typeof toneStyles;
  className?: string;
};

/** Status always includes a text label — never color alone. */
export function StatusBadge({ label, tone = "neutral", className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold tracking-wide",
        toneStyles[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
