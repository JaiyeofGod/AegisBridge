import type { AccountSnapshot } from "@/types/account";

/** Current-user view for USR-001. Values are synthetic and are not credentials. */
export const accountMock: AccountSnapshot = {
  dataClassification: "SIMULATED",
  environmentLabel: "Lab · Simulated",
  snapshotLabel: "DESIGN PREVIEW · Simulated account and session details",
  profile: {
    displayName: "Amara Okonkwo",
    fullName: "Amara Okonkwo",
    email: "amara.okonkwo@aegisbridge.example",
    emailStatus: "Verified · Simulated",
    jobTitle: "Security administrator",
    department: "Security",
    role: "Administrator",
    accountStatus: "Active",
    timezone: "America/New_York",
    initials: "AO",
    organization: "AegisBridge Labs",
    userId: "USR-001",
    memberSince: "04 Mar 2026",
    recordSource: "Snapshot 19 Oct 2026, 21:30 ET",
    identityNote:
      "Email changes require verification. Your display name appears on assignments, reviews, and audit history. This profile is a design preview and is not a live directory record.",
  },
  security: {
    signInMethod: "Organization sign-in · Managed by workspace",
    passwordStatus: "Workspace-managed. No password is stored on this screen.",
    mfaState: "Required by organization · Enrolled · Simulated",
    recovery: "Managed by identity provider. Recovery codes are not shown.",
    lastSignIn: "19 Oct 2026, 21:05 ET · Simulated",
    sessionPolicy:
      "Sign-in required. MFA expected for active users. Idle timeout label is 8 hours. This is policy text only.",
    sessions: [
      {
        id: "ses-current",
        device: "Mac · Browser",
        detail: "New York time zone · Current · Simulated",
        current: true,
      },
      {
        id: "ses-prior",
        device: "Mac · Browser",
        detail: "18 Oct 2026, 09:14 ET · Simulated",
        current: false,
      },
    ],
    activity: [
      {
        id: "auth-014",
        when: "19 Oct 2026, 21:05 ET",
        outcome: "Success",
        context: "Browser · Simulated",
      },
      {
        id: "auth-013",
        when: "18 Oct 2026, 09:14 ET",
        outcome: "Success",
        context: "Browser · Simulated",
      },
      {
        id: "auth-011",
        when: "16 Oct 2026, 14:02 ET",
        outcome: "Failed",
        context: "Unknown client · Simulated",
      },
    ],
    settings: [
      "Organization policy applies.",
      "Manage MFA at your identity provider. This prototype cannot enroll or disable MFA.",
      "Session revocation requires confirmation. Revoke stays unavailable.",
      "Session examples are simulated. Authentication tokens and recovery codes are not displayed.",
    ],
  },
  preferences: {
    theme: "Dark",
    density: "Comfortable",
    motion: "Follow device setting · Reduced motion supported",
    dateTime: "Local time with explicit zone",
    landingPage: "Overview",
    notifications: [
      { id: "tasks", label: "Assigned tasks", inApp: true, email: false },
      { id: "incidents", label: "Incident mentions", inApp: true, email: true },
      { id: "evidence", label: "Evidence due dates", inApp: true, email: true },
    ],
    notes: [
      "Changes on this page stay in the browser session and are not saved.",
      "Workspace security policy takes priority.",
      "Critical notices remain available in the inbox.",
      "Email delivery requires a configured provider. Email switches are design mockups.",
    ],
  },
  workspace: {
    organization: "AegisBridge Technologies",
    workspaceName: "AegisBridge Labs",
    workspaceType: "Simulated enterprise · Isolated cyber range",
    role: "Administrator · Managed by workspace owner",
    environment: "LAB · Simulated data",
    selector: "AegisBridge Labs · Current · 1 available workspace",
    membership: "Membership active",
    permissions: ["integration.manage", "user.role.manage"],
    evidenceStorage:
      "Cloudflare R2 is planned. No bucket name or credential is stored on this screen.",
    labConnection: "Not connected. The hosted app is separate from the private cyber range.",
    notes: [
      "LAB · SIMULATED",
      "This is your workspace view. User, role, and integration administration stays on the Administration page.",
      "Workspace switching preserves the distinction between enterprise records and isolated range activity.",
      "No other organization is available.",
    ],
  },
};
