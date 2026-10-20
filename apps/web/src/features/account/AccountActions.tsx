import { Button } from "@/components/buttons/Button";

export function PrototypeAction({ label, reason }: { label: string; reason: string }) {
  return (
    <Button
      type="button"
      disabled
      title={reason}
      aria-label={`${label}. ${reason}`}
      className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      {label}
    </Button>
  );
}
