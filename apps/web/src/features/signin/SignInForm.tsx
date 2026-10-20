import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/buttons/Button";
import { Input } from "@/components/forms/Input";
import { SimulatedDataBanner } from "@/components/feedback/SimulatedDataBanner";

/**
 * UI-only authentication surface. No real auth, SSO, or production bypass.
 * Explore demo navigates to Overview with an explicit simulated label; Phase 2
 * must replace this with authenticated session handling.
 */
export function SignInForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  return (
    <div className="flex h-full flex-col justify-center px-6 py-10 md:px-12 lg:px-16">
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

        <SimulatedDataBanner message="UI-only sign-in — authentication is not connected" />

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
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
            hint="Placeholder control. Submitting does not authenticate."
          />
          <Button type="submit" fullWidth disabled title="Authentication arrives in Phase 2">
            Continue with email
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
          <p className="text-sm font-semibold text-[var(--text)]">Explore the demo</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Opens Overview with simulated AegisBridge Technologies data. Not a production auth
            bypass.
          </p>
          <Button
            type="button"
            variant="ghost"
            className="mt-3 border border-[var(--border)]"
            fullWidth
            data-testid="explore-demo"
            onClick={() => {
              navigate("/overview", { state: { demoEntry: true } });
            }}
          >
            Explore demo (SIMULATED)
          </Button>
        </div>

        <p className="text-xs text-[var(--muted)]">
          Authorized access only. This portfolio environment uses fictional organizational data.
        </p>
      </div>
    </div>
  );
}
