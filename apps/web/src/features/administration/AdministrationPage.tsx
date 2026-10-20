import { useState } from "react";

import { Button } from "@/components/buttons/Button";
import { Panel } from "@/components/cards/Panel";
import { SummaryMetric } from "@/components/cards/SummaryMetric";
import { SimulatedDataBanner } from "@/components/feedback/SimulatedDataBanner";
import { AppShell } from "@/components/navigation/AppShell";
import { PageContainer } from "@/components/navigation/PageContainer";
import { PageHeader } from "@/components/navigation/PageHeader";
import { StatusBadge } from "@/components/status/StatusBadge";
import { IntegrationTable } from "@/features/administration/IntegrationTable";
import { useAdministrationData } from "@/features/administration/useAdministrationData";
import { cn } from "@/lib/cn";
import type { AdminSectionId, IntegrationRecord } from "@/types/administration";

const sections: { id: AdminSectionId; label: string }[] = [
  { id: "integrations", label: "Integrations" },
  { id: "users", label: "Users" },
  { id: "roles", label: "Roles & Permissions" },
  { id: "audit", label: "Audit History" },
  { id: "workspace", label: "Workspace" },
];

export function AdministrationPage() {
  const admin = useAdministrationData();
  const [section, setSection] = useState<AdminSectionId>("integrations");
  const [selectedId, setSelectedId] = useState("int-wazuh");
  const selected =
    admin.data.integrations.find((item) => item.id === selectedId) ?? admin.data.integrations[0];

  return (
    <AppShell environmentLabel={admin.data.environmentLabel}>
      <PageContainer data-testid="administration-page">
        <PageHeader
          title="Administration"
          description="Manage integrations, permissions, and accountable configuration."
          actions={
            <div className="flex flex-col items-end gap-2.5">
              <Button
                type="button"
                disabled
                title="Integration setup is not connected in this phase"
                aria-label="Add integration (not connected in this phase)"
              >
                Add integration
              </Button>
              <SimulatedDataBanner message={admin.data.snapshotLabel} />
            </div>
          }
        />

        <div
          role="tablist"
          aria-label="Administration sections"
          className="mb-8 flex flex-wrap gap-2 border-b border-[var(--border)] pb-3"
        >
          {sections.map((item) => {
            const active = item.id === section;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
                  active
                    ? "bg-[var(--raised)] text-[var(--accent)]"
                    : "text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]",
                )}
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-8">
          {section === "integrations" && selected ? (
            <>
              <section aria-labelledby="admin-summary-heading">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2
                    id="admin-summary-heading"
                    className="font-heading text-xl font-bold text-[var(--text)]"
                  >
                    Platform snapshot
                  </h2>
                  <StatusBadge label="SIMULATED" tone="warning" />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {admin.data.metrics.map((metric) => (
                    <SummaryMetric key={metric.id} metric={metric} />
                  ))}
                </div>
                <p className="mt-4 text-xs text-[var(--muted)]">
                  Pending access reviews: 2. There is no aggregate security score.
                </p>
              </section>

              <Panel
                title="Integration connections"
                description="Catalog references and planned connectors. None are live."
              >
                <IntegrationTable
                  integrations={admin.data.integrations}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </Panel>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
                <Panel title="Configuration controls" className="h-full">
                  <IntegrationDetail integration={selected} />
                </Panel>
                <Panel title="Workflow & interpretation" className="h-full">
                  <ul className="space-y-3">
                    {admin.data.workflowNotes.map((note) => (
                      <li
                        key={note}
                        className="rounded-[var(--radius-control)] bg-[var(--raised)] px-3 py-3 text-sm leading-relaxed text-[var(--muted)]"
                      >
                        {note}
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </>
          ) : null}

          {section === "users" ? (
            <Panel
              title="Users"
              description="Fictional accounts. Sign-in and MFA enrollment are not connected."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
            >
              <div className="overflow-x-auto" data-testid="admin-users">
                <table className="min-w-full border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Workspace users with role, department, account status, MFA state, last sign-in,
                    and access review
                  </caption>
                  <thead className="text-[var(--muted)]">
                    <tr>
                      {[
                        "User",
                        "Email",
                        "Role",
                        "Department",
                        "Status",
                        "MFA",
                        "Last sign-in",
                        "Access review",
                      ].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="px-3 py-3 font-medium whitespace-nowrap"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {admin.data.users.map((user) => (
                      <tr key={user.id} className="border-t border-[var(--border)]">
                        <td className="px-3 py-3 text-[var(--text)]">
                          {user.userId}
                          <span className="mt-1 block text-xs text-[var(--muted)]">
                            {user.name}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[var(--muted)]">{user.email}</td>
                        <td className="px-3 py-3 text-[var(--text)]">{user.role}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">{user.department}</td>
                        <td className="px-3 py-3 text-[var(--text)]">{user.accountStatus}</td>
                        <td className="px-3 py-3 text-[var(--text)]">{user.mfa}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                          {user.lastSignIn}
                        </td>
                        <td className="px-3 py-3 text-[var(--text)]">{user.accessReview}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          {section === "roles" ? (
            <Panel
              title="Roles & Permissions"
              description="Role summaries only. The server does not enforce these assignments yet."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
            >
              <ul className="space-y-3" data-testid="admin-roles">
                {admin.data.roles.map((role) => (
                  <li
                    key={role.id}
                    className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                  >
                    <p className="font-medium text-[var(--text)]">{role.name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{role.summary}</p>
                    <p className="mt-1 text-sm text-[var(--text)]">
                      {role.permissions.join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {section === "audit" ? (
            <Panel
              title="Audit History"
              description="Simulated events. Not a live audit trail."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
            >
              <div className="overflow-x-auto" data-testid="admin-audit">
                <table className="min-w-full border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Simulated audit events with time, actor, action, object, result, source, and
                    environment
                  </caption>
                  <thead className="text-[var(--muted)]">
                    <tr>
                      {[
                        "Event",
                        "Time",
                        "Actor",
                        "Action",
                        "Object",
                        "Result",
                        "Source",
                        "Environment",
                      ].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="px-3 py-3 font-medium whitespace-nowrap"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {admin.data.audit.map((event) => (
                      <tr key={event.id} className="border-t border-[var(--border)]">
                        <td className="px-3 py-3 text-[var(--text)]">{event.auditId}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                          {event.timestamp}
                        </td>
                        <td className="px-3 py-3 text-[var(--muted)]">{event.actor}</td>
                        <td className="px-3 py-3 text-[var(--text)]">{event.action}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">
                          {event.objectType} · {event.objectId}
                        </td>
                        <td className="px-3 py-3 text-[var(--text)]">{event.result}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">{event.source}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">{event.environment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          {section === "workspace" ? (
            <Panel
              title="Workspace"
              description="Prototype settings. No secrets are stored on this screen."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
            >
              <dl className="space-y-3" data-testid="admin-workspace">
                {admin.data.workspace.map((setting) => (
                  <div
                    key={setting.id}
                    className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                  >
                    <dt className="text-sm text-[var(--muted)]">{setting.label}</dt>
                    <dd className="mt-1 text-sm text-[var(--text)]">{setting.value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ) : null}
        </div>
      </PageContainer>
    </AppShell>
  );
}

function IntegrationDetail({ integration }: { integration: IntegrationRecord }) {
  return (
    <div className="space-y-4 text-sm" data-testid="admin-integration-detail">
      <div>
        <p className="text-[var(--muted)]">Integration</p>
        <p className="mt-1 text-[var(--text)]">
          {integration.name} · {integration.status} · {integration.freshness}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Secrets</p>
        <p className="mt-1 text-[var(--text)]">
          Masked values. Stored secrets are not shown. {integration.authState}.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Permissions</p>
        <p className="mt-1 text-[var(--text)]">
          integration.manage would be required later. Least privilege is not enforced on this
          screen.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Changes</p>
        <p className="mt-1 text-[var(--text)]">
          Audit actor, timestamp, and changed fields would be recorded. This row is simulated.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Connection</p>
        <p className="mt-1 text-[var(--text)]">
          {integration.notes} Last sync {integration.lastSync}. Scope {integration.scope}.
        </p>
      </div>
    </div>
  );
}
