import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/buttons/Button";
import { Input } from "@/components/forms/Input";
import { authKeys } from "@/features/auth/auth-keys";
import { ApiError } from "@/services/api-client";
import { loginWithPassword } from "@/services/auth";

const DEV_EMAIL_HINT = "amara.okonkwo@aegisbridge.example";

/**
 * Local password sign-in against the FastAPI session cookie.
 * Session tokens stay HttpOnly and are never stored in JavaScript.
 */
export function SignInForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: () => loginWithPassword(email.trim(), password),
    onSuccess: async () => {
      setPassword("");
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: authKeys.session });
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
      navigate("/overview", { replace: true });
    },
    onError: (error) => {
      setPassword("");
      if (error instanceof ApiError && error.status === 401) {
        setFormError("Invalid email or password.");
        return;
      }
      setFormError("Sign-in could not be completed. Try again.");
    },
  });

  return (
    <div className="motion-signin-enter flex h-full flex-col justify-center px-6 py-10 md:px-12 lg:px-16">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-[var(--accent)] uppercase">
            Welcome back
          </p>
          <h2 className="font-heading mt-2 text-3xl font-bold text-[var(--text)]">Sign in</h2>
          <p className="mt-2 text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
            YOUR SECURITY WORKSPACE
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (login.isPending) return;
            setFormError(null);
            login.mutate();
          }}
          noValidate
        >
          <Input
            label="Work email"
            type="email"
            name="email"
            autoComplete="username"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={login.isPending}
          />
          <Input
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={login.isPending}
            error={formError ?? undefined}
          />
          <Button
            type="submit"
            fullWidth
            disabled={login.isPending || email.trim().length === 0 || password.length === 0}
            aria-busy={login.isPending || undefined}
          >
            {login.isPending ? "Signing in…" : "Continue with email"}
          </Button>
        </form>

        <div className="relative py-2 text-center text-xs tracking-wide text-[var(--muted)] uppercase">
          <span className="bg-[var(--canvas)] px-2">or</span>
          <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-[var(--border)]" />
        </div>

        <Button type="button" variant="secondary" fullWidth disabled title="SSO arrives later">
          Organization SSO
        </Button>

        <div className="rounded-[var(--radius-panel)] border border-dashed border-[var(--border)] p-4">
          <p className="text-sm font-semibold text-[var(--text)]">Development sign-in</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Local seed account email (password comes from your private environment configuration and
            is never shown here):
          </p>
          <p className="mt-2 font-mono text-xs text-[var(--text)]" data-testid="dev-email-hint">
            {DEV_EMAIL_HINT}
          </p>
        </div>

        <p className="text-xs text-[var(--muted)]">
          Authorized access only. This portfolio environment uses fictional organizational data.
          Frontend route checks are UX only; server authorization is enforced separately.
        </p>
      </div>
    </div>
  );
}
