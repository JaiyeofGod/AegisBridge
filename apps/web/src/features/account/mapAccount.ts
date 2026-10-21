import { formatTimestamp } from "@/lib/format";
import type {
  AccountPreferencesResponse,
  AccountProfileResponse,
  AccountSecurityResponse,
  AccountWorkspaceResponse,
  CurrentUser,
} from "@/services/api-types";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function mapAccountProfile(profile: AccountProfileResponse, me?: CurrentUser | null) {
  return {
    id: profile.id,
    displayName: profile.display_name,
    fullName: profile.display_name,
    email: profile.email,
    department: profile.department ?? "Not recorded",
    accountStatus: profile.account_status,
    jobTitle: profile.job_title ?? me?.job_title ?? "Not recorded",
    timezone: profile.timezone,
    organization: profile.organization,
    createdAt: formatTimestamp(profile.created_at),
    dataOrigin: profile.data_origin,
    initials: initialsFromName(profile.display_name),
    role: me?.roles[0] ?? "Not recorded",
  };
}

export function mapAccountSecurity(security: AccountSecurityResponse) {
  const current = security.current_session;
  return {
    passwordConfigured: security.password_authentication_configured,
    passwordStatus: security.password_authentication_configured
      ? "Local password authentication is configured."
      : "Local password authentication is not configured.",
    mfaStatus: security.mfa_status,
    mfaLabel:
      security.mfa_status === "not_configured"
        ? "Not configured in this phase"
        : security.mfa_status,
    activeSessionCount: security.active_session_count,
    lastAuthenticatedAt: security.last_authenticated_at
      ? formatTimestamp(security.last_authenticated_at)
      : "Not recorded",
    semantics: security.semantics,
    currentSession: current
      ? {
          id: current.id,
          createdAt: formatTimestamp(current.created_at),
          lastSeenAt: formatTimestamp(current.last_seen_at),
          expiresAt: formatTimestamp(current.expires_at),
          current: current.current,
        }
      : null,
  };
}

export function mapAccountPreferences(preferences: AccountPreferencesResponse) {
  const persistence = preferences.persistence;
  const isDefault = persistence === "default";
  const isStored = persistence === "stored";
  return {
    persistence,
    isDefault,
    isStored,
    persistenceLabel: isStored ? "Stored" : isDefault ? "Default" : persistence,
    theme: preferences.theme,
    density: preferences.density,
    landingPage: preferences.landing_page,
    reducedMotion: preferences.reduced_motion,
    semantics: preferences.semantics,
    updatedAt: preferences.updated_at ?? null,
  };
}

export function mapAccountWorkspace(workspace: AccountWorkspaceResponse) {
  return {
    organization: workspace.organization,
    department: workspace.department ?? "Not recorded",
    roles: workspace.roles,
    permissions: workspace.permissions,
    privileged: workspace.privileged,
    environmentLabel: workspace.environment_label,
    dataOrigin: workspace.data_origin,
    privilegedRoles: workspace.privileged_roles,
    semantics: workspace.semantics,
  };
}
