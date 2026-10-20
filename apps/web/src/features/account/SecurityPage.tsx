import { Panel } from "@/components/cards/Panel";
import { StatusBadge } from "@/components/status/StatusBadge";
import { AccountField } from "@/features/account/AccountField";
import { AccountLayout } from "@/features/account/AccountLayout";
import { PrototypeAction } from "@/features/account/AccountActions";
import { useAccountData } from "@/features/account/useAccountData";

export function SecurityPage() {
  const account = useAccountData();
  const security = account.data.security;

  return (
    <AccountLayout
      title="Account security"
      crumb="Account security"
      description="Review sign-in protection and active account sessions."
      actions={
        <PrototypeAction
          label="Save changes"
          reason="Security changes are not saved in this prototype."
        />
      }
    >
      <div className="space-y-4" data-testid="account-security">
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.8fr)]">
          <Panel title="Authentication">
            <AccountField label="Sign-in method" value={security.signInMethod} />
            <AccountField label="Password status" value={security.passwordStatus} />
            <AccountField label="Multi-factor authentication" value={security.mfaState} />
            <AccountField label="Recovery options" value={security.recovery} />
            <AccountField label="Session policy" value={security.sessionPolicy} />
            <div className="flex flex-wrap gap-2 pt-4">
              <PrototypeAction
                label="Change password"
                reason="Prototype only. This control does not change a password."
              />
              <PrototypeAction
                label="Enable MFA"
                reason="Prototype only. This control does not enroll or change MFA."
              />
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Change password does not change a password. Enable MFA does not enroll or change MFA.
              Revoke session does not revoke a session. Nothing on this page updates authentication.
            </p>
          </Panel>

          <Panel title="Security settings">
            <ul className="space-y-3">
              {security.settings.map((note) => (
                <li key={note} className="text-sm text-[var(--muted)]">
                  {note}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel title="Active sessions">
          <ul className="space-y-4">
            {security.sessions.map((session) => (
              <li key={session.id} className="border-b border-[var(--border)] pb-4 last:border-b-0">
                <div className="text-xs text-[var(--muted)]">
                  {session.current ? "Current session" : "Earlier session"}
                </div>
                <div className="mt-1 text-sm text-[var(--text)]">{session.device}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-[var(--muted)]">{session.detail}</span>
                  <StatusBadge
                    label={session.current ? "Current · Simulated" : "Inactive · Simulated"}
                    tone={session.current ? "accent" : "neutral"}
                  />
                </div>
                <div className="mt-3">
                  <PrototypeAction
                    label="Revoke session"
                    reason="Prototype only. This control does not revoke a session."
                  />
                </div>
              </li>
            ))}
          </ul>
          <AccountField label="Last successful sign-in" value={security.lastSignIn} />
        </Panel>

        <Panel title="Recent sign-in activity">
          <ul className="space-y-3">
            {security.activity.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-[var(--text)]">{event.when}</span>
                <StatusBadge
                  label={event.outcome === "Success" ? "Success · Simulated" : "Failed · Simulated"}
                  tone={event.outcome === "Success" ? "success" : "warning"}
                />
                <span className="text-[var(--muted)]">{event.context}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AccountLayout>
  );
}
