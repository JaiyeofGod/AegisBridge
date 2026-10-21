import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/buttons/Button";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { logoutCurrentSession } from "@/services/auth";

export function LogoutButton({
  variant = "secondary",
}: {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const navigate = useNavigate();
  const { clearAuthCaches } = useAuthActions();
  const [error, setError] = useState<string | null>(null);

  const logout = useMutation({
    mutationFn: logoutCurrentSession,
    onSuccess: async () => {
      setError(null);
      await clearAuthCaches();
      navigate("/signin", { replace: true });
    },
    onError: () => {
      setError("Sign-out could not be completed. The server session may still be active.");
    },
  });

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <Button
        type="button"
        variant={variant}
        disabled={logout.isPending}
        aria-busy={logout.isPending || undefined}
        onClick={() => logout.mutate()}
        data-testid="sign-out-button"
      >
        {logout.isPending ? "Signing out…" : "Sign out"}
      </Button>
      {error ? (
        <p className="text-xs text-[var(--critical)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
