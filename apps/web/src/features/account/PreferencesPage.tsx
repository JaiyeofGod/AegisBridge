import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { Panel } from "@/components/cards/Panel";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { AccountField } from "@/features/account/AccountField";
import { AccountLayout } from "@/features/account/AccountLayout";
import { useAccountPreferencesQuery } from "@/features/account/useAccountData";
import { accountKeys } from "@/features/auth/auth-keys";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { cn } from "@/lib/cn";
import { ApiError } from "@/services/api-client";
import { updateAccountPreferences } from "@/services/account";
import type { AccountPreferencesUpdate, DensityValue, ThemeValue } from "@/services/api-types";

const themes = ["system", "dark", "light"] as const satisfies readonly ThemeValue[];
const densities = ["comfortable", "compact"] as const satisfies readonly DensityValue[];

export function PreferencesPage() {
  const preferencesQuery = useAccountPreferencesQuery();
  const preferences = preferencesQuery.data;
  const queryClient = useQueryClient();
  const { handleAccountUnauthorized } = useAuthActions();

  const [theme, setTheme] = useState<ThemeValue | null>(null);
  const [density, setDensity] = useState<DensityValue | null>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset local drafts when the server snapshot changes after save/refetch.
  useEffect(() => {
    if (!preferences) return;
    setTheme(null);
    setDensity(null);
    setReducedMotion(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional field snapshot
  }, [
    preferences?.theme,
    preferences?.density,
    preferences?.reducedMotion,
    preferences?.updatedAt,
    preferences?.persistence,
  ]);

  const themeValue = theme ?? (preferences?.theme as ThemeValue | undefined) ?? "system";
  const densityValue =
    density ?? (preferences?.density as DensityValue | undefined) ?? "comfortable";
  const reducedMotionValue = reducedMotion ?? preferences?.reducedMotion ?? false;

  const save = useMutation({
    mutationFn: async () => {
      if (!preferences) {
        throw new ApiError("Preferences are not loaded.", 400);
      }
      const patch: AccountPreferencesUpdate = {};
      if (themeValue !== preferences.theme) {
        patch.theme = themeValue;
      }
      if (densityValue !== preferences.density) {
        patch.density = densityValue;
      }
      if (reducedMotionValue !== preferences.reducedMotion) {
        patch.reduced_motion = reducedMotionValue;
      }
      if (Object.keys(patch).length === 0) {
        throw new ApiError("No preference changes to save.", 400, "no_changes");
      }
      return updateAccountPreferences(patch);
    },
    onSuccess: async (result) => {
      setFormError(null);
      setSuccessMessage("Preferences saved.");
      setTheme(null);
      setDensity(null);
      setReducedMotion(null);
      queryClient.setQueryData(accountKeys.preferences, result);
      await queryClient.invalidateQueries({ queryKey: accountKeys.preferences });
    },
    onError: async (error) => {
      setSuccessMessage(null);
      if (await handleAccountUnauthorized(error)) {
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setFormError("You do not have permission to update preferences.");
          return;
        }
        if (error.status === 422) {
          setFormError(error.message || "One or more preference values are invalid.");
          return;
        }
        if (error.code === "no_changes") {
          setFormError("No preference changes to save.");
          return;
        }
        setFormError(error.message || "Preferences could not be saved.");
        return;
      }
      setFormError("Preferences could not be saved.");
    },
  });

  return (
    <AccountLayout
      title="Preferences"
      crumb="Preferences"
      description="Choose how AegisBridge looks. Supported settings are saved to your account."
      actions={
        <Button
          type="button"
          disabled={!preferences || save.isPending}
          aria-busy={save.isPending || undefined}
          onClick={() => {
            setSuccessMessage(null);
            setFormError(null);
            save.mutate();
          }}
          data-testid="preferences-save"
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
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
          <div
            className={cn(
              "rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-3 py-2 text-sm",
              preferences.isStored ? "text-[var(--accent)]" : "text-[var(--warning)]",
            )}
            data-testid="preferences-persistence"
          >
            Persistence: {preferences.persistenceLabel}. {preferences.semantics}
          </div>
          {successMessage ? (
            <p
              className="text-sm text-[var(--accent)]"
              role="status"
              data-testid="preferences-success"
            >
              {successMessage}
            </p>
          ) : null}
          {formError ? (
            <p
              className="text-sm text-[var(--critical)]"
              role="alert"
              data-testid="preferences-error"
            >
              {formError}
            </p>
          ) : null}
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.8fr)]">
            <Panel title="Appearance">
              <ChoiceGroup
                label="Theme"
                value={themeValue}
                options={themes}
                onChange={(next) => {
                  setTheme(next as ThemeValue);
                  setSuccessMessage(null);
                }}
                hint="Saved to your account when you click Save changes."
              />
              <ChoiceGroup
                label="Display density"
                value={densityValue}
                options={densities}
                onChange={(next) => {
                  setDensity(next as DensityValue);
                  setSuccessMessage(null);
                }}
                hint="Saved to your account when you click Save changes."
              />
              <AccountField
                label="Default landing page"
                value={preferences.landingPage}
                hint="Only overview is supported. Other landing pages are not persisted."
              />
              <ChoiceGroup
                label="Reduced motion"
                value={reducedMotionValue ? "on" : "off"}
                options={["on", "off"]}
                onChange={(next) => {
                  setReducedMotion(next === "on");
                  setSuccessMessage(null);
                }}
                hint="Saved to your account when you click Save changes."
              />
            </Panel>
            <Panel title="Persistence">
              <p className="text-sm text-[var(--muted)]">
                Theme, density, and reduced motion are the supported stored fields. After a
                successful save, values are marked Stored and remain after refresh. Unsupported
                settings are not sent to the API.
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
