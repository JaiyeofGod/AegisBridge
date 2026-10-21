import { useQuery } from "@tanstack/react-query";

import { accountKeys } from "@/features/auth/auth-keys";
import {
  mapAccountPreferences,
  mapAccountProfile,
  mapAccountSecurity,
  mapAccountWorkspace,
} from "@/features/account/mapAccount";
import { useAuthActions, useAuthStatus } from "@/features/auth/useAuthSession";
import {
  fetchAccountPreferences,
  fetchAccountProfile,
  fetchAccountSecurity,
  fetchAccountWorkspace,
} from "@/services/account";

async function withAccountAuth<T>(
  loader: () => Promise<T>,
  handleUnauthorized: (error: unknown) => Promise<boolean>,
): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    await handleUnauthorized(error);
    throw error;
  }
}

export function useAccountProfileQuery() {
  const auth = useAuthStatus();
  const { handleAccountUnauthorized } = useAuthActions();
  return useQuery({
    queryKey: accountKeys.profile,
    queryFn: () => withAccountAuth(fetchAccountProfile, handleAccountUnauthorized),
    enabled: auth.isAuthenticated,
    retry: false,
    staleTime: 30_000,
    select: (data) => mapAccountProfile(data, auth.user),
  });
}

export function useAccountSecurityQuery() {
  const auth = useAuthStatus();
  const { handleAccountUnauthorized } = useAuthActions();
  return useQuery({
    queryKey: accountKeys.security,
    queryFn: () => withAccountAuth(fetchAccountSecurity, handleAccountUnauthorized),
    enabled: auth.isAuthenticated,
    retry: false,
    staleTime: 30_000,
    select: mapAccountSecurity,
  });
}

export function useAccountPreferencesQuery() {
  const auth = useAuthStatus();
  const { handleAccountUnauthorized } = useAuthActions();
  return useQuery({
    queryKey: accountKeys.preferences,
    queryFn: () => withAccountAuth(fetchAccountPreferences, handleAccountUnauthorized),
    enabled: auth.isAuthenticated,
    retry: false,
    staleTime: 30_000,
    select: mapAccountPreferences,
  });
}

export function useAccountWorkspaceQuery() {
  const auth = useAuthStatus();
  const { handleAccountUnauthorized } = useAuthActions();
  return useQuery({
    queryKey: accountKeys.workspace,
    queryFn: () => withAccountAuth(fetchAccountWorkspace, handleAccountUnauthorized),
    enabled: auth.isAuthenticated,
    retry: false,
    staleTime: 30_000,
    select: mapAccountWorkspace,
  });
}

/** Environment label for account shell chrome. */
export function useAccountShellMeta() {
  const auth = useAuthStatus();
  return {
    environmentLabel: auth.user?.environment_label ?? "Lab · Development",
    dataOrigin: auth.user?.data_origin ?? "development",
  };
}
