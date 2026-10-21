import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { authKeys, accountKeys } from "@/features/auth/auth-keys";
import { ApiError } from "@/services/api-client";
import { fetchAuthSession } from "@/services/auth";

export function useAuthSession() {
  return useQuery({
    queryKey: authKeys.session,
    queryFn: fetchAuthSession,
    retry: false,
    staleTime: 30_000,
  });
}

export function useAuthStatus() {
  const session = useAuthSession();
  const pending = session.isPending || (session.isFetching && session.data === undefined);
  return {
    status: session.status,
    isPending: pending,
    isAuthenticated: session.data?.authenticated === true,
    user: session.data?.user ?? null,
    sessionId: session.data?.session_id ?? null,
    error: session.error,
    refetch: session.refetch,
  };
}

export function useAuthActions() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function invalidateAuthState() {
    await queryClient.invalidateQueries({ queryKey: authKeys.session });
    await queryClient.invalidateQueries({ queryKey: authKeys.me });
    await queryClient.invalidateQueries({ queryKey: accountKeys.all });
  }

  async function clearAuthCaches() {
    queryClient.removeQueries({ queryKey: authKeys.session });
    queryClient.removeQueries({ queryKey: authKeys.me });
    queryClient.removeQueries({ queryKey: accountKeys.all });
    await queryClient.invalidateQueries({ queryKey: authKeys.session });
  }

  async function handleAccountUnauthorized(error: unknown) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      return false;
    }
    await clearAuthCaches();
    navigate("/signin", { replace: true });
    return true;
  }

  return { invalidateAuthState, clearAuthCaches, handleAccountUnauthorized };
}
