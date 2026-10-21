import { Panel } from "@/components/cards/Panel";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { StatusBadge } from "@/components/status/StatusBadge";
import { AccountField } from "@/features/account/AccountField";
import { AccountLayout } from "@/features/account/AccountLayout";
import { PrototypeAction } from "@/features/account/AccountActions";
import { useAccountProfileQuery } from "@/features/account/useAccountData";

export function ProfilePage() {
  const profileQuery = useAccountProfileQuery();
  const profile = profileQuery.data;

  return (
    <AccountLayout
      title="My profile"
      crumb="My profile"
      description="Review your personal information and workspace identity."
      actions={
        <PrototypeAction
          label="Save changes"
          reason="Profile edits are not connected. No write API exists in this phase."
        />
      }
    >
      {profileQuery.isPending ? <LoadingState label="Updating profile" /> : null}
      {profileQuery.isError ? (
        <ErrorState
          title="Profile unavailable"
          description="The profile request failed. Fixture account data is not substituted."
          onRetry={() => void profileQuery.refetch()}
        />
      ) : null}
      {profile ? (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.8fr)]">
          <Panel title="Personal details" data-testid="account-profile">
            <AccountField label="Display name" value={profile.displayName} />
            <AccountField label="Full name" value={profile.fullName} />
            <AccountField
              label="Email address"
              value={profile.email}
              hint="Work email is read-only. Changes would require verification, which is not connected."
            />
            <AccountField label="Job title" value={profile.jobTitle} />
            <AccountField label="Department" value={profile.department} />
            <AccountField
              label="Assigned role"
              value={profile.role}
              hint="Role is managed by the workspace owner and is read-only here."
            />
            <AccountField label="Account status" value={profile.accountStatus} />
            <AccountField label="Time zone" value={profile.timezone} />
            <AccountField label="User ID" value={profile.id} />
            <AccountField label="Member since" value={profile.createdAt} />
            <AccountField label="Data origin" value={profile.dataOrigin} />
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
              <StatusBadge label={profile.accountStatus} tone="success" />
            </div>
            <p className="mt-4 text-sm text-[var(--muted)]">
              Authenticated session data from the development API. Password hashes and session
              tokens are never shown.
            </p>
          </Panel>
        </div>
      ) : null}
    </AccountLayout>
  );
}
