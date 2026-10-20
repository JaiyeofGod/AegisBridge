import { Panel } from "@/components/cards/Panel";
import { StatusBadge } from "@/components/status/StatusBadge";
import { AccountField } from "@/features/account/AccountField";
import { AccountLayout } from "@/features/account/AccountLayout";
import { PrototypeAction } from "@/features/account/AccountActions";
import { useAccountData } from "@/features/account/useAccountData";

export function ProfilePage() {
  const account = useAccountData();
  const profile = account.data.profile;

  return (
    <AccountLayout
      title="My profile"
      crumb="My profile"
      description="Manage your personal information and workspace identity."
      actions={
        <PrototypeAction
          label="Save changes"
          reason="Profile edits are not saved in this prototype."
        />
      }
    >
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.8fr)]">
        <Panel title="Personal details" data-testid="account-profile">
          <AccountField label="Display name" value={profile.displayName} />
          <AccountField label="Full name" value={profile.fullName} />
          <AccountField
            label="Email address"
            value={`${profile.email} · ${profile.emailStatus}`}
            hint="Work email is read-only. Changes would require verification, which is not connected."
          />
          <AccountField label="Job title" value={profile.jobTitle} />
          <AccountField label="Department" value={profile.department} />
          <AccountField
            label="Assigned role"
            value={profile.role}
            hint="Role is managed by the workspace owner and is read-only here."
          />
          <AccountField label="Account status" value={`${profile.accountStatus} · Simulated`} />
          <div className="border-b border-[var(--border)] py-4">
            <label htmlFor="profile-timezone" className="text-xs text-[var(--muted)]">
              Time zone
            </label>
            <select
              id="profile-timezone"
              className="mt-2 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] disabled:opacity-70"
              value={profile.timezone}
              disabled
              title="Time zone edits are not connected in this prototype."
            >
              <option value={profile.timezone}>{profile.timezone}</option>
            </select>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Time zone edits are not connected in this prototype.
            </p>
          </div>
          <AccountField label="User ID" value={profile.userId} />
          <AccountField label="Member since" value={profile.memberSince} />
          <AccountField label="Profile metadata" value={profile.recordSource} />
        </Panel>

        <Panel>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--raised)] text-sm font-semibold text-[var(--text)]"
              aria-hidden
            >
              {profile.initials}
            </span>
            <div>
              <p className="font-heading text-lg text-[var(--text)]">{profile.displayName}</p>
              <p className="text-sm text-[var(--muted)]">{profile.jobTitle}</p>
              <p className="text-sm text-[var(--muted)]">{profile.organization}</p>
            </div>
          </div>
          <div className="mt-4">
            <StatusBadge label={`${profile.accountStatus} · Simulated`} tone="success" />
          </div>
          <p className="mt-4 text-sm text-[var(--muted)]">{profile.identityNote}</p>
        </Panel>
      </div>
    </AccountLayout>
  );
}
