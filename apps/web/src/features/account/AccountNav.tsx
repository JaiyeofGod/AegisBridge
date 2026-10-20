import { NavLink } from "react-router-dom";

import { cn } from "@/lib/cn";
import type { AccountRoute } from "@/types/account";

const sections: { to: AccountRoute; label: string }[] = [
  { to: "/account/profile", label: "My profile" },
  { to: "/account/security", label: "Account security" },
  { to: "/account/preferences", label: "Preferences" },
  { to: "/account/workspace", label: "Workspace" },
];

export function AccountNav() {
  return (
    <nav
      aria-label="Account sections"
      className="mb-8 flex flex-wrap gap-2 border-b border-[var(--border)] pb-3"
    >
      {sections.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              "inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-sm font-semibold",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
              isActive
                ? "bg-[var(--raised)] text-[var(--accent)]"
                : "text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]",
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
