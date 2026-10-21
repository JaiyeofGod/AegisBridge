import { Link } from "react-router-dom";

import { Button } from "@/components/buttons/Button";
import { Panel } from "@/components/cards/Panel";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { StatusBadge } from "@/components/status/StatusBadge";
import { AccountField } from "@/features/account/AccountField";
import { AccountLayout } from "@/features/account/AccountLayout";
import { PrototypeAction } from "@/features/account/AccountActions";
import { useAccountWorkspaceQuery } from "@/features/account/useAccountData";
import { useAuthStatus } from "@/features/auth/useAuthSession";

export function WorkspacePage() {
  const workspaceQuery = useAccountWorkspaceQuery();
  const workspace = workspaceQuery.data;
  const auth = useAuthStatus();
  const canOpenAdministration =
    auth.user?.permissions.includes("administration.read") === true ||
    auth.user?.privileged === true;

  return (
    <AccountLayout
      title="Workspace"
      crumb="Workspace"
      description="Review your organization, environment, and membership."
      actions={
        canOpenAdministration ? (
          <Button
            asChild
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <Link to="/administration">Administration</Link>
          </Button>
        ) : (
          <PrototypeAction
            label="Administration"
            reason="administration.read is required. Hiding this action is UX only."
          />
        )
      }
    >
      {workspaceQuery.isPending ? <LoadingState label="Updating workspace" /> : null}
      {workspaceQuery.isError ? (
        <ErrorState
          title="Workspace unavailable"
          description="The workspace request failed. Fixture workspace data is not substituted."
          onRetry={() => void workspaceQuery.refetch()}
        />
      ) : null}
      {workspace ? (
        <div className="space-y-4" data-testid="account-workspace">
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.8fr)]">
            <Panel title="Organization details">
              <AccountField label="Organization" value={workspace.organization} />
              <AccountField label="Department" value={workspace.department} />
              <AccountField label="Roles" value={workspace.roles.join(", ") || "None"} />
              <AccountField label="Environment" value={workspace.environmentLabel} />
              <AccountField label="Data origin" value={workspace.dataOrigin} />
              <AccountField
                label="Privileged"
                value={workspace.privileged ? "Yes" : "No"}
                hint={`Privileged roles from API: ${workspace.privilegedRoles.join(", ")}`}
              />
              <AccountField
                label="Effective permissions"
                value={workspace.permissions.join(", ") || "None"}
                hint="Server-returned capability labels. Frontend hiding is not authorization."
              />
            </Panel>

            <Panel>
              <h2 className="font-heading text-lg text-[var(--accent)]">
                {workspace.organization}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge label={workspace.environmentLabel} tone="accent" />
                <StatusBadge
                  label={workspace.privileged ? "Privileged" : "Standard access"}
                  tone={workspace.privileged ? "warning" : "neutral"}
                />
              </div>
              <p className="mt-4 text-sm text-[var(--muted)]">{workspace.semantics}</p>
            </Panel>
          </div>

          <Panel title="Workspace actions">
            {canOpenAdministration ? (
              <AccountField
                label="Administration"
                hint="Opens Administration. Domain GET routes remain publicly readable until backend enforcement."
              >
                <Button asChild variant="secondary">
                  <Link to="/administration">
                    Manage users, roles, integrations and audit history
                  </Link>
                </Button>
              </AccountField>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Administration is hidden because this session lacks administration.read.
              </p>
            )}
            <div className="pt-4">
              <PrototypeAction
                label="Switch organization"
                reason="No other organization is available. This control does not change the workspace."
              />
            </div>
          </Panel>
        </div>
      ) : null}
    </AccountLayout>
  );
}
