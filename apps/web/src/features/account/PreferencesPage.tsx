import { useState } from "react";

import { Panel } from "@/components/cards/Panel";
import { AccountField } from "@/features/account/AccountField";
import { AccountLayout } from "@/features/account/AccountLayout";
import { PrototypeAction } from "@/features/account/AccountActions";
import { useAccountData } from "@/features/account/useAccountData";
import { cn } from "@/lib/cn";
import type { NotificationPreference } from "@/types/account";

const themes = ["Dark", "Light", "System"] as const;
const densities = ["Comfortable", "Compact"] as const;
const landingPages = ["Overview", "Governance", "Risks", "SOC Operations"] as const;

export function PreferencesPage() {
  const account = useAccountData();
  const seed = account.data.preferences;
  const [theme, setTheme] = useState<(typeof themes)[number]>(seed.theme);
  const [density, setDensity] = useState<(typeof densities)[number]>(seed.density);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [landingPage, setLandingPage] = useState(seed.landingPage);
  const [notifications, setNotifications] = useState<NotificationPreference[]>(seed.notifications);

  function toggleInApp(id: string) {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, inApp: !item.inApp } : item)),
    );
  }

  return (
    <AccountLayout
      title="Preferences"
      crumb="Preferences"
      description="Choose how AegisBridge looks and which updates you receive."
      actions={
        <PrototypeAction
          label="Save changes"
          reason="Preference changes stay in this browser session and are not saved."
        />
      }
    >
      <div className="space-y-4" data-testid="account-preferences">
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.8fr)]">
          <Panel title="Appearance & accessibility">
            <ChoiceGroup label="Theme" value={theme} options={themes} onChange={setTheme} />
            <ChoiceGroup
              label="Display density"
              value={density}
              options={densities}
              onChange={setDensity}
              hint="Table density follows this display setting. The choice is local only."
            />
            <div className="border-b border-[var(--border)] py-4">
              <div className="text-xs text-[var(--muted)]">Motion</div>
              <p className="mt-1 text-sm text-[var(--text)]">{seed.motion}</p>
              <label className="mt-3 flex min-h-11 items-center gap-3 text-sm text-[var(--text)]">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  checked={reducedMotion}
                  onChange={(event) => setReducedMotion(event.target.checked)}
                />
                Prefer reduced motion in this page preview
              </label>
              <p className="mt-1 text-xs text-[var(--muted)]">
                The product follows the device reduced-motion setting. This checkbox is not saved.
                Current preview: {reducedMotion ? "Reduced motion on" : "Follow device setting"}.
              </p>
            </div>
            <AccountField label="Date & time" value={seed.dateTime} />
            <div className="py-4">
              <label htmlFor="default-landing-page" className="text-xs text-[var(--muted)]">
                Default landing page
              </label>
              <select
                id="default-landing-page"
                className="mt-2 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                value={landingPage}
                onChange={(event) => setLandingPage(event.target.value)}
              >
                {landingPages.map((page) => (
                  <option key={page} value={page}>
                    {page}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Local preview only. Opening the app still starts at the current route.
              </p>
            </div>
          </Panel>

          <Panel title="Your preferences">
            <ul className="space-y-3">
              {seed.notes.map((note) => (
                <li key={note} className="text-sm text-[var(--muted)]">
                  {note}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel title="Notifications">
          <ul className="space-y-4">
            {notifications.map((item) => (
              <li key={item.id} className="border-b border-[var(--border)] pb-4 last:border-b-0">
                <div className="text-sm text-[var(--text)]">{item.label}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    aria-pressed={item.inApp}
                    onClick={() => toggleInApp(item.id)}
                  >
                    In-app: {item.inApp ? "On" : "Off"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-sm text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-70"
                    aria-pressed={item.email}
                    disabled
                    title="Email delivery is not connected. This switch does not send mail."
                    aria-label={`${item.label} email. Email delivery is not connected.`}
                  >
                    Email: {item.email ? "On" : "Off"} · Not connected
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AccountLayout>
  );
}

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  hint = "Local preview only. This choice is not saved.",
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  hint?: string;
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
                "inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-sm",
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
