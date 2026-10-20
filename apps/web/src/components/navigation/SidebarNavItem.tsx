import { NavLink } from "react-router-dom";

import { cn } from "@/lib/cn";
import type { NavItem } from "@/types/navigation";

export function SidebarNavItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  if (!item.implemented) {
    return (
      <span
        className="flex min-h-11 items-center justify-between rounded-[var(--radius-control)] px-3 text-sm text-[var(--muted)] opacity-70"
        title="Not available in this phase"
        aria-disabled="true"
      >
        <span>{item.label}</span>
        <span className="text-[10px] uppercase tracking-wide">Soon</span>
      </span>
    );
  }

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-sm font-medium",
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
