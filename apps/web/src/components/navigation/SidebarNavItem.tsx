import { NavLink } from "react-router-dom";

import { cn } from "@/lib/cn";
import type { NavItem } from "@/types/navigation";

export function SidebarNavItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  if (!item.implemented) {
    return (
      <span
        className="motion-nav flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm leading-snug text-[var(--muted)] opacity-70"
        title="Not available in this phase"
        aria-disabled="true"
      >
        <span className="min-w-0">{item.label}</span>
        <span className="shrink-0 text-[10px] uppercase tracking-wide">Soon</span>
      </span>
    );
  }

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "motion-nav flex min-h-11 items-center rounded-[var(--radius-control)] px-3 py-2 text-sm leading-snug font-medium",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
          isActive
            ? "bg-[var(--raised)] text-[var(--accent)]"
            : "text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]",
        )
      }
    >
      {item.label}
    </NavLink>
  );
}
