import { formatTimestamp } from "@/lib/format";
import type {
  AccessReviewListItem,
  AdministrationSummary,
  AdminRoleListItem,
  AdminUserListItem,
  AuditEventListItem,
  IntegrationListItem,
} from "@/services/api-types";
import type { OverviewMetric } from "@/types/overview";

export type IntegrationView = {
  id: string;
  name: string;
  provider: string;
  status: string;
  statusLabel: string;
  freshness: string;
  freshnessLabel: string;
  lastSyncAt: string;
  lastSuccessAt: string;
  credentialState: string;
  notes: string;
};

export type AdminUserView = {
  id: string;
  displayName: string;
  email: string;
  status: string;
  department: string;
  roleNames: string[];
  roles: string;
  privileged: boolean;
  privilegedLabel: string;
  updatedAt: string | null;
};

export type AdminRoleView = {
  id: string;
  name: string;
  summary: string;
  permissions: string[];
};

export type AuditEventView = {
  id: string;
  occurredAt: string;
  actor: string;
  action: string;
  objectType: string;
  objectId: string;
  result: string;
  source: string;
  environment: string;
  detail: string | null;
};

export type AccessReviewView = {
  id: string;
  name: string;
  status: string;
  owner: string;
  openFindingCount: number;
  totalFindingCount: number;
  dueAt: string;
  updatedAt: string | null;
};

const statusLabels: Record<string, string> = {
  configured: "Configured",
  not_configured: "Not configured",
  reference_only: "Reference only",
  not_connected: "Not connected",
  delayed: "Delayed",
  healthy: "Healthy",
};

export function storedStatusLabel(status: string) {
  return statusLabels[status] ?? status;
}

export function mapAdministrationSummary(summary: AdministrationSummary): OverviewMetric[] {
  const statusText = breakdown(summary.integration_status);
  const freshnessText = breakdown(summary.integration_freshness);
  return [
    {
      id: "configured-integrations",
      label: "Configured integrations",
      primaryValue: String(summary.configured_integration_count),
      secondaryLabel: "Stored status",
      secondaryValue: statusText || "No integration status stored",
      tone: "neutral",
      freshness: statusText ? "fresh" : "empty",
      semantics:
        "Configured counts only integrations whose stored status is configured. not_configured and reference_only stay absent.",
    },
    {
      id: "integration-freshness",
      label: "Integration freshness",
      primaryValue: freshnessText || "None stored",
      secondaryLabel: "Stored freshness",
      secondaryValue: freshnessText ? "Not a live connector" : "No sync state stored",
      tone: "neutral",
      freshness: freshnessText ? "fresh" : "empty",
      semantics:
        "not_connected means the connector is absent. A missing sync is not a healthy zero.",
    },
    {
      id: "active-users",
      label: "Active users",
      primaryValue: String(summary.active_user_count),
      secondaryLabel: "Stored account status",
      secondaryValue: "Active",
      tone: "neutral",
      freshness: "fresh",
      semantics: "Active users are stored accounts whose status is active.",
    },
    {
      id: "privileged-users",
      label: "Privileged users",
      primaryValue: String(summary.privileged_user_count),
      secondaryLabel: "Privileged roles from the API",
      secondaryValue: summary.privileged_roles.join(" · ") || "None stored",
      tone: "neutral",
      freshness: "fresh",
      semantics: summary.semantics,
    },
  ];
}

export function mapIntegration(item: IntegrationListItem): IntegrationView {
  const freshness = item.freshness ?? "not_stored";
  return {
    id: item.id,
    name: item.name,
    provider: item.provider,
    status: item.status,
    statusLabel: storedStatusLabel(item.status),
    freshness,
    freshnessLabel: freshness === "not_stored" ? "Not stored" : storedStatusLabel(freshness),
    lastSyncAt: item.last_sync_at ? formatTimestamp(item.last_sync_at) : "Not recorded",
    lastSuccessAt: item.last_success_at ? formatTimestamp(item.last_success_at) : "Not recorded",
    credentialState: item.credential_state,
    notes: item.notes ?? "No integration note is stored.",
  };
}

export function mapAdminUser(item: AdminUserListItem): AdminUserView {
  return {
    id: item.id,
    displayName: item.display_name,
    email: item.email,
    status: item.status,
    department: item.department ?? "Not stored",
    roleNames: [...item.roles],
    roles: item.roles.length > 0 ? item.roles.join(", ") : "No role stored",
    privileged: item.privileged,
    privilegedLabel: item.privileged ? "Privileged" : "Not privileged",
    updatedAt: item.updated_at ?? null,
  };
}

export function mapAdminRole(item: AdminRoleListItem): AdminRoleView {
  return {
    id: item.id,
    name: item.name,
    summary: item.summary,
    permissions: item.permissions,
  };
}

export function mapAuditEvent(item: AuditEventListItem): AuditEventView {
  return {
    id: item.id,
    occurredAt: formatTimestamp(item.occurred_at),
    actor: item.actor ? `${item.actor.display_name} · ${item.actor.id}` : item.actor_label,
    action: item.action,
    objectType: item.object_type,
    objectId: item.object_id,
    result: item.result,
    source: item.source,
    environment: item.environment_name,
    detail: item.detail,
  };
}

export function mapAccessReview(item: AccessReviewListItem): AccessReviewView {
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    owner: item.owner ? `${item.owner.display_name} · ${item.owner.id}` : "Owner not stored",
    openFindingCount: item.open_finding_count,
    totalFindingCount: item.total_finding_count,
    dueAt: item.due_at ? formatTimestamp(item.due_at) : "Due date not stored",
    updatedAt: item.updated_at ?? null,
  };
}

function breakdown(counts: Record<string, number>) {
  return Object.entries(counts)
    .map(([status, count]) => `${count} ${status}`)
    .join(" · ");
}
