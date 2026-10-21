import { BrandMark } from "@/components/navigation/BrandMark";
import { primaryNav } from "@/components/navigation/nav-config";
import { SidebarNavItem } from "@/components/navigation/SidebarNavItem";
import { useAuthStatus } from "@/features/auth/useAuthSession";
import { cn } from "@/lib/cn";

export function Sidebar({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const auth = useAuthStatus();
  const canSeeAdministration =
    auth.user?.permissions.includes("administration.read") === true ||
    auth.user?.privileged === true;
  const items = primaryNav.filter((item) => item.to !== "/administration" || canSeeAdministration);

  return (
    <aside
      className={cn(
        "flex h-full w-[var(--sidebar-width)] flex-col border-r border-[var(--border)] bg-[var(--surface)]",
        className,
      )}
      aria-label="Primary"
    >
      <div className="border-b border-[var(--border)] px-4 py-4">
        <BrandMark />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Modules">
        {items.map((item) => (
          <SidebarNavItem key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="border-t border-[var(--border)] p-4 text-xs text-[var(--muted)]">
        Portfolio demo environment
      </div>
    </aside>
  );
}
