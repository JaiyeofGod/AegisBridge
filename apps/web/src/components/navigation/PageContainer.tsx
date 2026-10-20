import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export function PageContainer({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
}) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-8", className)}
      {...props}
    >
      {children}
    </div>
  );
}
