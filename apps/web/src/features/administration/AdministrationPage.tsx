import { useState } from "react";

import { Button } from "@/components/buttons/Button";
import { Panel } from "@/components/cards/Panel";
import { SummaryMetric } from "@/components/cards/SummaryMetric";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { SimulatedDataBanner } from "@/components/feedback/SimulatedDataBanner";
import { AppShell } from "@/components/navigation/AppShell";
import { PageContainer } from "@/components/navigation/PageContainer";
import { PageHeader } from "@/components/navigation/PageHeader";
import { StatusBadge } from "@/components/status/StatusBadge";
import { StaleDataIndicator } from "@/components/status/StaleDataIndicator";
import { AccessReviewEditor } from "@/features/administration/AccessReviewEditor";
import {
  mapAccessReview,
  mapAdminRole,
  mapAdminUser,
  mapAdministrationSummary,
  mapAuditEvent,
  mapIntegration,
  type AccessReviewView,
  type AdminUserView,
} from "@/features/administration/mapAdministration";
import { IntegrationTable } from "@/features/administration/IntegrationTable";
import { UserRolesEditor } from "@/features/administration/UserRolesEditor";
import { UserStatusEditor } from "@/features/administration/UserStatusEditor";
import {
  useAccessReviews,
  useAdminRoles,
  useAdminUsers,
  useAdministrationSummary,
  useAuditEvents,
  useIntegrations,
} from "@/features/administration/useAdministrationData";
import { useAuthStatus } from "@/features/auth/useAuthSession";
import { SEEDED_DATA_LABEL, SEEDED_DATA_NOTE } from "@/features/data-origin";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";

type AdminSectionId = "integrations" | "users" | "roles" | "audit" | "access-reviews" | "workspace";

const sections: { id: AdminSectionId; label: string }[] = [
  { id: "integrations", label: "Integrations" },
  { id: "users", label: "Users" },
  { id: "roles", label: "Roles & Permissions" },
  { id: "audit", label: "Audit History" },
  { id: "access-reviews", label: "Access reviews" },
  { id: "workspace", label: "Workspace" },
];

export function AdministrationPage() {
  const auth = useAuthStatus();
  const permissions = auth.user?.permissions ?? [];
  const canManageAdmin = permissions.includes("administration.manage");
  const canManageRoles = permissions.includes("user.role.manage");
  const summary = useAdministrationSummary();
  const integrations = useIntegrations();
  const users = useAdminUsers();
  const roles = useAdminRoles();
  const audits = useAuditEvents();
  const reviews = useAccessReviews();
  const [section, setSection] = useState<AdminSectionId>("integrations");
  const [selectedId, setSelectedId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedReviewId, setSelectedReviewId] = useState("");
  const generatedAt = summary.dataUpdatedAt
    ? new Date(summary.dataUpdatedAt).toISOString()
    : new Date().toISOString();
  const integrationItems = integrations.data?.items.map(mapIntegration) ?? [];
  const selected =
    integrationItems.find((item) => item.id === selectedId) ?? integrationItems[0] ?? null;
  const metrics = summary.data ? mapAdministrationSummary(summary.data) : null;
  const userItems = users.data?.items.map(mapAdminUser) ?? [];
  const selectedUser = userItems.find((item) => item.id === selectedUserId) ?? userItems[0] ?? null;
  const roleItems = roles.data?.items.map(mapAdminRole) ?? [];
  const auditItems = audits.data?.items.map(mapAuditEvent) ?? [];
  const reviewItems = reviews.data?.items.map(mapAccessReview) ?? [];
  const selectedReview =
    reviewItems.find((item) => item.id === selectedReviewId) ?? reviewItems[0] ?? null;
  const refreshing =
    summary.isFetching ||
    integrations.isFetching ||
    users.isFetching ||
    roles.isFetching ||
    audits.isFetching ||
    reviews.isFetching;

  return (
    <AppShell environmentLabel="Development · Seeded">
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
              <SimulatedDataBanner message={SEEDED_DATA_NOTE} />
              {summary.dataUpdatedAt ? (
                <p className="text-xs text-[var(--muted)]" data-testid="last-successful-fetch">
                  Last successful update: {formatTimestamp(generatedAt)}
                </p>
              ) : null}
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
                  "motion-control inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
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

        {summary.isPending ? <LoadingState label="Updating" rows={4} /> : null}
        {summary.isError ? (
          <ErrorState
            title="Administration data unavailable"
            description="The development administration API did not respond. Retry to load the seeded summary. Fixture rows are not substituted."
            lastSuccessfulAt={summary.dataUpdatedAt ? generatedAt : undefined}
            onRetry={() => void summary.refetch()}
          />
        ) : null}
        {summary.isSuccess && refreshing ? (
          <div className="mb-6">
            <StaleDataIndicator
              message="Refreshing development administration records"
              lastSuccessfulAt={generatedAt}
            />
          </div>
        ) : null}

        {summary.isSuccess && metrics ? (
          <div key={section} className="motion-panel space-y-8">
            {section === "integrations" ? (
              <>
                <section aria-labelledby="admin-summary-heading">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2
                      id="admin-summary-heading"
                      className="font-heading text-xl font-bold text-[var(--text)]"
                    >
                      Platform snapshot
                    </h2>
                    <StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {metrics.map((metric) => (
                      <SummaryMetric key={metric.id} metric={metric} />
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-[var(--muted)]">
                    Pending access reviews: {summary.data.pending_access_review_count}. Recent audit
                    events: {summary.data.recent_audit_event_count}. There is no aggregate security
                    score.
                  </p>
                </section>

                <Panel
                  title="Integration connections"
                  description="Stored catalog rows. A connector is not live unless its status says configured."
                >
                  {integrations.isPending ? <LoadingState label="Updating" rows={2} /> : null}
                  {integrations.isError ? (
                    <ErrorState
                      title="Integrations unavailable"
                      description="The integration request failed. Fixture connectors are not substituted."
                      onRetry={() => void integrations.refetch()}
                    />
                  ) : null}
                  {integrations.isSuccess && integrationItems.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No integrations are stored.</p>
                  ) : null}
                  {integrations.isSuccess && integrationItems.length > 0 ? (
                    <IntegrationTable
                      integrations={integrationItems}
                      selectedId={selected?.id ?? ""}
                      onSelect={setSelectedId}
                    />
                  ) : null}
                </Panel>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
                  <Panel title="Configuration controls" className="h-full">
                    {selected ? (
                      <IntegrationDetail integration={selected} />
                    ) : (
                      <p className="text-sm text-[var(--muted)]">No integration is selected.</p>
                    )}
                  </Panel>
                  <Panel title="Workflow & interpretation" className="h-full">
                    <ul className="space-y-3">
                      <li className="rounded-[var(--radius-control)] bg-[var(--raised)] px-3 py-3 text-sm leading-relaxed text-[var(--muted)]">
                        {summary.data.semantics}
                      </li>
                      <li className="rounded-[var(--radius-control)] bg-[var(--raised)] px-3 py-3 text-sm leading-relaxed text-[var(--muted)]">
                        Development seeded data. This is not live administration data. Wazuh and the
                        example identity provider are not connected.
                      </li>
                      <li className="rounded-[var(--radius-control)] bg-[var(--raised)] px-3 py-3 text-sm leading-relaxed text-[var(--muted)]">
                        Credentials and secrets are not returned. credential_state is a stored
                        label.
                      </li>
                    </ul>
                  </Panel>
                </div>
              </>
            ) : null}

            {section === "users" ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start">
                <Panel
                  title="Users"
                  description="Stored accounts. Sign-in and MFA enrollment are not connected."
                  action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
                >
                  {users.isPending ? <LoadingState label="Updating" rows={2} /> : null}
                  {users.isError ? (
                    <ErrorState
                      title="Users unavailable"
                      description="The user request failed. Fixture accounts are not substituted."
                      onRetry={() => void users.refetch()}
                    />
                  ) : null}
                  {users.isSuccess && userItems.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]" data-testid="admin-users">
                      No users are stored.
                    </p>
                  ) : null}
                  {users.isSuccess && userItems.length > 0 ? (
                    <div className="overflow-x-auto" data-testid="admin-users">
                      <table className="min-w-full border-collapse text-left text-sm">
                        <caption className="sr-only">
                          Stored users with display name, email, status, department, roles, and the
                          privileged flag returned by the API
                        </caption>
                        <thead className="text-[var(--muted)]">
                          <tr>
                            {["User", "Email", "Status", "Department", "Roles", "Privileged"].map(
                              (heading) => (
                                <th
                                  key={heading}
                                  scope="col"
                                  className="px-3 py-3 font-medium whitespace-nowrap"
                                >
                                  {heading}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {userItems.map((user) => {
                            const active = selectedUser?.id === user.id;
                            return (
                              <tr
                                key={user.id}
                                className={cn(
                                  "border-t border-[var(--border)]",
                                  active ? "bg-[var(--raised)]" : undefined,
                                )}
                              >
                                <td className="px-3 py-3 text-[var(--text)]">
                                  <button
                                    type="button"
                                    className="text-left font-medium text-[var(--accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                                    onClick={() => setSelectedUserId(user.id)}
                                    aria-pressed={active}
                                    data-testid={`admin-user-select-${user.id}`}
                                  >
                                    {user.id}
                                  </button>
                                  <span className="mt-1 block text-xs text-[var(--muted)]">
                                    {user.displayName}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-[var(--muted)]">{user.email}</td>
                                <td className="px-3 py-3 text-[var(--text)]">{user.status}</td>
                                <td className="px-3 py-3 text-[var(--muted)]">{user.department}</td>
                                <td className="px-3 py-3 text-[var(--text)]">{user.roles}</td>
                                <td className="px-3 py-3 text-[var(--text)]">
                                  {user.privilegedLabel}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </Panel>
                <Panel
                  title="Selected user"
                  description="Status and role changes use server permissions. Credentials are not editable."
                >
                  {selectedUser ? (
                    <UserAdminDetail
                      user={selectedUser}
                      canManageAdmin={canManageAdmin}
                      canManageRoles={canManageRoles}
                    />
                  ) : (
                    <p className="text-sm text-[var(--muted)]">No user is selected.</p>
                  )}
                </Panel>
              </div>
            ) : null}

            {section === "roles" ? (
              <Panel
                title="Roles & Permissions"
                description="Stored role catalog. Permission labels are not authorization checks."
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                {roles.isPending ? <LoadingState label="Updating" rows={2} /> : null}
                {roles.isError ? (
                  <ErrorState
                    title="Roles unavailable"
                    description="The role request failed. Fixture roles are not substituted."
                    onRetry={() => void roles.refetch()}
                  />
                ) : null}
                {roles.isSuccess && roleItems.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]" data-testid="admin-roles">
                    No roles are stored.
                  </p>
                ) : null}
                {roles.isSuccess && roleItems.length > 0 ? (
                  <ul className="space-y-3" data-testid="admin-roles">
                    {roleItems.map((role) => (
                      <li
                        key={role.id}
                        className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                      >
                        <p className="font-medium text-[var(--text)]">{role.name}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{role.summary}</p>
                        <p className="mt-1 text-sm text-[var(--text)]">
                          {role.permissions.length > 0
                            ? role.permissions.join(" · ")
                            : "No permission labels are stored for this role."}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Panel>
            ) : null}

            {section === "audit" ? (
              <Panel
                title="Audit History"
                description="Stored audit events. This is not a live audit trail."
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                {audits.isPending ? <LoadingState label="Updating" rows={2} /> : null}
                {audits.isError ? (
                  <ErrorState
                    title="Audit events unavailable"
                    description="The audit request failed. Fixture events are not substituted."
                    onRetry={() => void audits.refetch()}
                  />
                ) : null}
                {audits.isSuccess && auditItems.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]" data-testid="admin-audit">
                    No audit events are stored.
                  </p>
                ) : null}
                {audits.isSuccess && auditItems.length > 0 ? (
                  <div className="overflow-x-auto" data-testid="admin-audit">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <caption className="sr-only">
                        Stored audit events with time, actor, action, object, result, source, and
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
                        {auditItems.map((event) => (
                          <tr key={event.id} className="border-t border-[var(--border)]">
                            <td className="px-3 py-3 text-[var(--text)]">{event.id}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                              {event.occurredAt}
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
                ) : null}
              </Panel>
            ) : null}

            {section === "access-reviews" ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:items-start">
                <Panel
                  title="Access reviews"
                  description="Stored review records. Owner and due date appear only when the API returns them."
                  action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
                >
                  {reviews.isPending ? <LoadingState label="Updating" rows={2} /> : null}
                  {reviews.isError ? (
                    <ErrorState
                      title="Access reviews unavailable"
                      description="The access-review request failed. Fixture reviews are not substituted."
                      onRetry={() => void reviews.refetch()}
                    />
                  ) : null}
                  {reviews.isSuccess && reviewItems.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]" data-testid="admin-access-reviews">
                      No access reviews are stored.
                    </p>
                  ) : null}
                  {reviews.isSuccess && reviewItems.length > 0 ? (
                    <ul className="space-y-3" data-testid="admin-access-reviews">
                      {reviewItems.map((review) => {
                        const active = selectedReview?.id === review.id;
                        return (
                          <li key={review.id}>
                            <button
                              type="button"
                              className={cn(
                                "w-full rounded-[var(--radius-control)] border px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
                                active
                                  ? "border-[var(--accent)] bg-[var(--raised)]"
                                  : "border-[var(--border)] bg-[var(--raised)]",
                              )}
                              onClick={() => setSelectedReviewId(review.id)}
                              aria-pressed={active}
                              data-testid={`admin-review-select-${review.id}`}
                            >
                              <p className="font-medium text-[var(--text)]">
                                {review.id} · {review.name}
                              </p>
                              <p className="mt-1 text-sm text-[var(--muted)]">
                                {review.status} · {review.owner} · {review.dueAt}
                              </p>
                              <p className="mt-1 text-sm text-[var(--text)]">
                                Open findings {review.openFindingCount} / {review.totalFindingCount}
                              </p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </Panel>
                <Panel
                  title="Selected access review"
                  description="Name and status only. Findings are not editable in this phase."
                >
                  {selectedReview ? (
                    <AccessReviewDetail review={selectedReview} canManage={canManageAdmin} />
                  ) : (
                    <p className="text-sm text-[var(--muted)]">No access review is selected.</p>
                  )}
                </Panel>
              </div>
            ) : null}

            {section === "workspace" ? (
              <Panel
                title="Workspace"
                description="Workspace writes are not connected. No secrets are stored on this screen."
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                <dl className="space-y-3" data-testid="admin-workspace">
                  <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3">
                    <dt className="text-sm text-[var(--muted)]">Privileged roles</dt>
                    <dd className="mt-1 text-sm text-[var(--text)]">
                      {summary.data.privileged_roles.join(" · ") || "No privileged roles stored"}
                    </dd>
                  </div>
                  <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3">
                    <dt className="text-sm text-[var(--muted)]">Stored semantics</dt>
                    <dd className="mt-1 text-sm text-[var(--text)]">{summary.data.semantics}</dd>
                  </div>
                  <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3">
                    <dt className="text-sm text-[var(--muted)]">Identity provider</dt>
                    <dd className="mt-1 text-sm text-[var(--text)]">
                      Not connected. Workspace settings are not stored by this API.
                    </dd>
                  </div>
                </dl>
              </Panel>
            ) : null}
          </div>
        ) : null}
      </PageContainer>
    </AppShell>
  );
}

function IntegrationDetail({ integration }: { integration: ReturnType<typeof mapIntegration> }) {
  return (
    <div className="space-y-4 text-sm" data-testid="admin-integration-detail">
      <div>
        <p className="text-[var(--muted)]">Integration</p>
        <p className="mt-1 text-[var(--text)]">
          {integration.id} · {integration.name} · {integration.provider} · {integration.statusLabel}{" "}
          · {integration.status}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Freshness</p>
        <p className="mt-1 text-[var(--text)]">
          {integration.freshnessLabel} · {integration.freshness}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Credential state</p>
        <p className="mt-1 text-[var(--text)]">
          Credentials are not stored or displayed. {integration.credentialState}.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Sync history</p>
        <p className="mt-1 text-[var(--text)]">
          Last sync {integration.lastSyncAt}. Last success {integration.lastSuccessAt}.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Notes</p>
        <p className="mt-1 text-[var(--text)]">{integration.notes}</p>
      </div>
    </div>
  );
}

function UserAdminDetail({
  user,
  canManageAdmin,
  canManageRoles,
}: {
  user: AdminUserView;
  canManageAdmin: boolean;
  canManageRoles: boolean;
}) {
  return (
    <div className="space-y-6 text-sm" data-testid="admin-user-detail">
      <div>
        <p className="text-[var(--muted)]">User</p>
        <p className="mt-1 text-[var(--text)]">
          {user.id} · {user.displayName} · {user.email}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {user.department} · {user.privilegedLabel}
        </p>
      </div>
      <div>
        <p className="mb-2 text-[var(--muted)]">Account status</p>
        <UserStatusEditor
          userId={user.id}
          status={user.status}
          updatedAt={user.updatedAt}
          canManage={canManageAdmin}
        />
      </div>
      <div>
        <p className="mb-2 text-[var(--muted)]">Role assignment</p>
        <UserRolesEditor
          userId={user.id}
          roleNames={user.roleNames}
          updatedAt={user.updatedAt}
          canManageRoles={canManageRoles}
        />
      </div>
    </div>
  );
}

function AccessReviewDetail({
  review,
  canManage,
}: {
  review: AccessReviewView;
  canManage: boolean;
}) {
  return (
    <div className="space-y-4 text-sm" data-testid="admin-access-review-detail">
      <div>
        <p className="text-[var(--muted)]">Review</p>
        <p className="mt-1 text-[var(--text)]">
          {review.id} · Open findings {review.openFindingCount} / {review.totalFindingCount}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {review.owner} · {review.dueAt}
        </p>
      </div>
      <AccessReviewEditor
        reviewId={review.id}
        name={review.name}
        status={review.status}
        updatedAt={review.updatedAt}
        canManage={canManage}
      />
    </div>
  );
}
