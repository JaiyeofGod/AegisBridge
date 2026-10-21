import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/buttons/Button";
import { Panel } from "@/components/cards/Panel";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { StatusBadge } from "@/components/status/StatusBadge";
import { AccountField } from "@/features/account/AccountField";
import { AccountLayout } from "@/features/account/AccountLayout";
import { PrototypeAction } from "@/features/account/AccountActions";
import { useAccountSecurityQuery } from "@/features/account/useAccountData";
import { accountKeys } from "@/features/auth/auth-keys";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { logoutAllSessions } from "@/services/auth";

export function SecurityPage() {
  const securityQuery = useAccountSecurityQuery();
  const security = securityQuery.data;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { clearAuthCaches } = useAuthActions();
  const [logoutAllError, setLogoutAllError] = useState<string | null>(null);

  const logoutAll = useMutation({
    mutationFn: logoutAllSessions,
    onSuccess: async () => {
      setLogoutAllError(null);
      await clearAuthCaches();
      await queryClient.invalidateQueries({ queryKey: accountKeys.security });
      navigate("/signin", { replace: true });
    },
    onError: () => {
      setLogoutAllError(
        "Sign-out of all sessions could not be completed. Server sessions may still be active.",
      );
    },
  });

  return (
    <AccountLayout
      title="Account security"
      crumb="Account security"
      description="Review sign-in protection and the current authenticated session."
      actions={
        <PrototypeAction
          label="Save changes"
          reason="Security changes are not saved. No write API exists in this phase."
        />
      }
    >
      {securityQuery.isPending ? <LoadingState label="Updating security" /> : null}
      {securityQuery.isError ? (
        <ErrorState
          title="Security details unavailable"
          description="The security request failed. Fixture session rows are not substituted."
          onRetry={() => void securityQuery.refetch()}
        />
      ) : null}
      {security ? (
        <div className="space-y-4" data-testid="account-security">
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.8fr)]">
            <Panel title="Authentication">
              <AccountField label="Sign-in method" value="Local email and password" />
              <AccountField label="Password status" value={security.passwordStatus} />
              <AccountField label="Multi-factor authentication" value={security.mfaLabel} />
              <AccountField label="Active sessions" value={String(security.activeSessionCount)} />
              <AccountField label="Last authenticated" value={security.lastAuthenticatedAt} />
              <div className="flex flex-wrap gap-2 pt-4">
                <PrototypeAction
                  label="Change password"
                  reason="Password change is not connected in this phase."
                />
                <PrototypeAction
                  label="Enable MFA"
                  reason="MFA enrollment is not available in this phase."
                />
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">{security.semantics}</p>
            </Panel>

            <Panel title="Security notes">
              <ul className="space-y-3 text-sm text-[var(--muted)]">
                <li>Password hashes and session tokens are never displayed.</li>
                <li>MFA is not configured for this phase.</li>
                <li>Frontend route guards are UX only until backend domain authz is enforced.</li>
              </ul>
            </Panel>
          </div>

          <Panel title="Current session">
            {security.currentSession ? (
              <ul className="space-y-4">
                <li className="border-b border-[var(--border)] pb-4">
                  <div className="text-xs text-[var(--muted)]">Current session</div>
                  <div className="mt-1 text-sm text-[var(--text)]">
                    {security.currentSession.id}
                  </div>
                  <AccountField label="Created" value={security.currentSession.createdAt} />
                  <AccountField label="Last seen" value={security.currentSession.lastSeenAt} />
                  <AccountField label="Expires" value={security.currentSession.expiresAt} />
                  <div className="mt-2">
                    <StatusBadge label="Current" tone="accent" />
                  </div>
                </li>
              </ul>
            ) : (
              <p className="text-sm text-[var(--muted)]">No current session metadata is stored.</p>
            )}
            <div className="pt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={logoutAll.isPending}
                aria-busy={logoutAll.isPending || undefined}
                data-testid="logout-all-button"
                onClick={() => logoutAll.mutate()}
              >
                {logoutAll.isPending ? "Signing out all sessions…" : "Sign out all sessions"}
              </Button>
              {logoutAllError ? (
                <p className="mt-2 text-xs text-[var(--critical)]" role="alert">
                  {logoutAllError}
                </p>
              ) : null}
            </div>
          </Panel>
        </div>
      ) : null}
    </AccountLayout>
  );
}
