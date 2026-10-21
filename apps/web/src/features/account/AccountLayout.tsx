import type { ReactNode } from "react";

import { AppShell } from "@/components/navigation/AppShell";
import { PageContainer } from "@/components/navigation/PageContainer";
import { PageHeader } from "@/components/navigation/PageHeader";
import { AccountNav } from "@/features/account/AccountNav";
import { LogoutButton } from "@/features/account/LogoutButton";
import { useAccountShellMeta } from "@/features/account/useAccountData";

export function AccountLayout({
  title,
  description,
  crumb,
  actions,
  children,
}: {
  title: string;
  description: string;
  crumb: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const shell = useAccountShellMeta();

  return (
    <AppShell environmentLabel={shell.environmentLabel}>
      <PageContainer data-testid="account-page">
        <p className="mb-3 text-xs text-[var(--muted)]">Account / {crumb}</p>
        <PageHeader
          title={title}
          description={description}
          actions={
            <div className="flex flex-col items-stretch gap-2.5 sm:items-end">
              {actions}
              <LogoutButton />
            </div>
          }
        />
        <AccountNav />
        {children}
      </PageContainer>
    </AppShell>
  );
}
