import { Link } from "react-router-dom";

import { Button } from "@/components/buttons/Button";
import { Panel } from "@/components/cards/Panel";
import { StatusBadge } from "@/components/status/StatusBadge";
import { AccountField } from "@/features/account/AccountField";
import { AccountLayout } from "@/features/account/AccountLayout";
import { PrototypeAction } from "@/features/account/AccountActions";
import { useAccountData } from "@/features/account/useAccountData";

export function WorkspacePage() {
  const account = useAccountData();
  const workspace = account.data.workspace;

  return (
    <AccountLayout
      title="Workspace"
      crumb="Workspace"
      description="Review your organization, environment, and membership."
      actions={
        <Button
          asChild
          className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <Link to="/administration">Administration</Link>
        </Button>
      }
    >
      <div className="space-y-4" data-testid="account-workspace">
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.8fr)]">
          <Panel title="Organization details">
            <AccountField label="Organization" value={workspace.organization} />
            <AccountField label="Workspace" value={workspace.workspaceName} />
            <AccountField label="Workspace type" value={workspace.workspaceType} />
            <AccountField label="Your role" value={workspace.role} />
            <AccountField label="Environment" value={workspace.environment} />
            <AccountField label="Organization selector" value={workspace.selector} />
            <AccountField label="Membership" value={`${workspace.membership} · Simulated`} />
            <AccountField
              label="Permission summary"
              value={workspace.permissions.join(", ")}
              hint="Permission names are labels for this user. They are not enforced in the prototype."
            />
            <AccountField label="Evidence storage" value={workspace.evidenceStorage} />
            <AccountField label="Lab connection mode" value={workspace.labConnection} />
          </Panel>

          <Panel>
            <h2 className="font-heading text-lg text-[var(--accent)]">{workspace.workspaceName}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge label="LAB · SIMULATED" tone="accent" />
              <StatusBadge label={workspace.membership} tone="success" />
            </div>
            <p className="mt-4 text-sm text-[var(--text)]">{workspace.role}</p>
            <ul className="mt-4 space-y-3">
              {workspace.notes.map((note) => (
                <li key={note} className="text-sm text-[var(--muted)]">
                  {note}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel title="Workspace actions">
          <AccountField
            label="Administration"
            hint="Opens the existing Administration screens. This page does not edit users or roles."
          >
            <Button
              asChild
              variant="secondary"
              className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <Link to="/administration">Manage users, roles, integrations and audit history</Link>
            </Button>
          </AccountField>
          <div className="pt-4">
            <PrototypeAction
              label="Switch organization"
              reason="No other organization is available. This control does not change the workspace."
            />
          </div>
        </Panel>
      </div>
    </AccountLayout>
  );
}
