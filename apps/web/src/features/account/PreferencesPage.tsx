import { useState } from "react";

import { Panel } from "@/components/cards/Panel";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { AccountField } from "@/features/account/AccountField";
import { AccountLayout } from "@/features/account/AccountLayout";
import { PrototypeAction } from "@/features/account/AccountActions";
import { useAccountPreferencesQuery } from "@/features/account/useAccountData";
import { cn } from "@/lib/cn";

const themes = ["system", "dark", "light"] as const;
const densities = ["comfortable", "compact"] as const;

export function PreferencesPage() {
  const preferencesQuery = useAccountPreferencesQuery();
  const preferences = preferencesQuery.data;
  const [theme, setTheme] = useState<string | null>(null);
  const [density, setDensity] = useState<string | null>(null);

  const themeValue = theme ?? preferences?.theme ?? "system";
  const densityValue = density ?? preferences?.density ?? "comfortable";

  return (
    <AccountLayout
      title="Preferences"
      crumb="Preferences"
      description="Choose how AegisBridge looks. Persistence is not connected yet."
      actions={
        <PrototypeAction
          label="Save changes"
          reason="Preferences are not persisted. No save API exists in this phase."
        />
      }
    >
      {preferencesQuery.isPending ? <LoadingState label="Updating preferences" /> : null}
      {preferencesQuery.isError ? (
        <ErrorState
          title="Preferences unavailable"
          description="The preferences request failed. Fixture preferences are not substituted."
          onRetry={() => void preferencesQuery.refetch()}
        />
      ) : null}
      {preferences ? (
        <div className="space-y-4" data-testid="account-preferences">
          <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-3 py-2 text-sm text-[var(--warning)]">
            Persistence: {preferences.persistence}. {preferences.semantics}
          </div>
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.8fr)]">
            <Panel title="Appearance">
              <ChoiceGroup
                label="Theme"
                value={themeValue}
                options={themes}
                onChange={setTheme}
                hint="Local preview only. Not persisted."
              />
              <ChoiceGroup
                label="Display density"
                value={densityValue}
                options={densities}
                onChange={setDensity}
                hint="Local preview only. Not persisted."
              />
              <AccountField
                label="Default landing page"
                value={preferences.landingPage}
                hint="Server default only. Not stored for this user."
              />
              <AccountField
                label="Reduced motion default"
                value={preferences.reducedMotion ? "On" : "Off"}
              />
            </Panel>
            <Panel title="Persistence">
              <p className="text-sm text-[var(--muted)]">
                Controls on this page do not call a save endpoint. Changing theme or density updates
                local UI state only and is labeled Not persisted.
              </p>
            </Panel>
          </div>
        </div>
      ) : null}
    </AccountLayout>
  );
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
  hint: string;
}) {
  return (
    <fieldset className="border-b border-[var(--border)] py-4">
      <legend className="text-xs text-[var(--muted)]">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              className={cn(
                "inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-sm capitalize",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
                selected
                  ? "bg-[var(--raised)] font-semibold text-[var(--accent)]"
                  : "text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]",
              )}
              onClick={() => onChange(option)}
            >
              {selected ? `${option} selected` : option}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">{hint}</p>
    </fieldset>
  );
}
