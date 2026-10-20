import type { OverviewMetric } from "@/types/overview";

export type AdminSectionId = "integrations" | "users" | "roles" | "audit" | "workspace";

export type IntegrationStatus =
  "Not configured" | "Configured" | "Simulated" | "Healthy" | "Delayed" | "Disabled" | "Planned";

export type IntegrationRecord = {
  id: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  lastSync: string;
  freshness: string;
  environment: string;
  authState: string;
  notes: string;
  scope: string;
};

export type AdminUser = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  accountStatus: "Active" | "Invited" | "Disabled";
  mfa: "On" | "Not enrolled";
  lastSignIn: string;
  accessReview: "Current" | "Review due" | "Not started";
};

export type AdminRole = {
  id: string;
  name: string;
  summary: string;
  permissions: string[];
};

export type AuditEvent = {
  id: string;
  auditId: string;
  timestamp: string;
  actor: string;
  action: string;
  objectType: string;
  objectId: string;
  result: string;
  source: string;
  environment: string;
};

export type WorkspaceSetting = {
  id: string;
  label: string;
  value: string;
};

export type AdminSnapshot = {
  dataClassification: "SIMULATED";
  generatedAt: string;
  lastSuccessfulFetchAt: string;
  environmentLabel: string;
  snapshotLabel: string;
  metrics: OverviewMetric[];
  integrations: IntegrationRecord[];
  users: AdminUser[];
  roles: AdminRole[];
  audit: AuditEvent[];
  workspace: WorkspaceSetting[];
  workflowNotes: string[];
};
