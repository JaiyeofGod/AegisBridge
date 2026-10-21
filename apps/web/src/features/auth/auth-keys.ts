export const authKeys = {
  session: ["auth", "session"] as const,
  me: ["auth", "me"] as const,
};

export const accountKeys = {
  profile: ["account", "profile"] as const,
  security: ["account", "security"] as const,
  preferences: ["account", "preferences"] as const,
  workspace: ["account", "workspace"] as const,
  all: ["account"] as const,
};
