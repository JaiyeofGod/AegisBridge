import { Bell } from "lucide-react";

export function NotificationButton() {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] text-[var(--text)]"
      aria-label="Notifications (not available in this phase)"
      disabled
      title="Notifications arrive in a later phase"
    >
      <Bell className="size-4" aria-hidden />
    </button>
  );
}
