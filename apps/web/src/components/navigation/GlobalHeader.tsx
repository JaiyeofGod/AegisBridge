import { Menu } from "lucide-react";
import { Link } from "react-router-dom";

import { EnvironmentBadge } from "@/components/status/EnvironmentBadge";
import { GlobalSearch } from "@/components/navigation/GlobalSearch";
import { NotificationButton } from "@/components/navigation/NotificationButton";
import { LogoutButton } from "@/features/account/LogoutButton";
import { useAuthStatus } from "@/features/auth/useAuthSession";

export function GlobalHeader({
  environmentLabel,
  onOpenNav,
}: {
  environmentLabel: string;
  onOpenNav?: () => void;
}) {
  const auth = useAuthStatus();

  return (
    <header className="flex min-h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:px-8">
      {onOpenNav ? (
        <button
          type="button"
          className="motion-control inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] lg:hidden"
          aria-label="Open navigation"
          onClick={onOpenNav}
        >
          <Menu className="size-5" aria-hidden />
        </button>
      ) : null}
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-2">
        <EnvironmentBadge label={environmentLabel} />
        <NotificationButton />
        <Link
          to="/account/profile"
          className="motion-control inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-3 text-sm font-medium text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          aria-label="Open my profile"
        >
          {auth.user?.display_name ?? "My Profile"}
        </Link>
        {auth.isAuthenticated ? <LogoutButton variant="ghost" /> : null}
      </div>
    </header>
  );
}
