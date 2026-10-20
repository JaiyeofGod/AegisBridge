export type AccountRoute =
  "/account/profile" | "/account/security" | "/account/preferences" | "/account/workspace";

export type AccountSession = {
  id: string;
  device: string;
  detail: string;
  current: boolean;
};

export type SignInActivity = {
  id: string;
  when: string;
  outcome: "Success" | "Failed";
  context: string;
};

export type NotificationPreference = {
  id: string;
  label: string;
  inApp: boolean;
  email: boolean;
};

export type AccountSnapshot = {
  dataClassification: "SIMULATED";
  environmentLabel: string;
  snapshotLabel: string;
  profile: {
    displayName: string;
    fullName: string;
    email: string;
    emailStatus: string;
    jobTitle: string;
    department: string;
    role: string;
    accountStatus: string;
    timezone: string;
    initials: string;
    organization: string;
    userId: string;
    memberSince: string;
    recordSource: string;
    identityNote: string;
  };
  security: {
    signInMethod: string;
    passwordStatus: string;
    mfaState: string;
    recovery: string;
    lastSignIn: string;
    sessionPolicy: string;
    sessions: AccountSession[];
    activity: SignInActivity[];
    settings: string[];
  };
  preferences: {
    theme: "Dark" | "Light" | "System";
    density: "Comfortable" | "Compact";
    motion: string;
    dateTime: string;
    landingPage: string;
    notifications: NotificationPreference[];
    notes: string[];
  };
  workspace: {
    organization: string;
    workspaceName: string;
    workspaceType: string;
    role: string;
    environment: string;
    selector: string;
    membership: string;
    permissions: string[];
    evidenceStorage: string;
    labConnection: string;
    notes: string[];
  };
};
