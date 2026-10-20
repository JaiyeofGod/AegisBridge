import { StatusBadge } from "@/components/status/StatusBadge";

export function EnvironmentBadge({ label }: { label: string }) {
  return <StatusBadge label={label} tone="accent" />;
}
