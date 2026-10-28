import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  [
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)]",
    "motion-control px-4 text-sm font-semibold",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-[var(--accent)] text-[var(--ink)] hover:brightness-110",
        secondary:
          "border border-[var(--border)] bg-[var(--raised)] text-[var(--text)] hover:border-[var(--accent)]",
        ghost: "bg-transparent text-[var(--text)] hover:bg-[var(--raised)]",
        danger: "bg-[var(--critical)] text-[var(--ink)] hover:brightness-110",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      fullWidth: false,
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  className,
  variant,
  fullWidth,
  asChild = false,
  type = "button",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, fullWidth }), className)}
      type={asChild ? undefined : type}
      {...props}
    />
  );
}
