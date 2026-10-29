import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { LoadingState } from "@/components/feedback/LoadingState";
import { ProminentLoadingState } from "@/components/feedback/ProminentLoadingState";
import { useAuthStatus } from "@/features/auth/useAuthSession";

/** UX-only guard. Backend domain authorization is enforced in a later slice. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuthStatus();

  if (auth.isPending) {
    return (
      <div data-testid="auth-loading">
        <ProminentLoadingState label="Checking session" />
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  return children;
}

/** UX-only guest gate for /signin. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const auth = useAuthStatus();

  if (auth.isPending) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8" data-testid="auth-loading">
        <LoadingState label="Checking session" />
      </div>
    );
  }

  if (auth.isAuthenticated) {
    return <Navigate to="/overview" replace />;
  }

  return children;
}
