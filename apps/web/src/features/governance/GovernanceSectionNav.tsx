import { cn } from "@/lib/cn";
import type { GovernanceSectionId } from "@/types/governance";

const sections: { id: GovernanceSectionId; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "frameworks", label: "Frameworks" },
  { id: "controls", label: "Controls" },
  { id: "evidence", label: "Evidence" },
  { id: "policies", label: "Policies" },
  { id: "access-reviews", label: "Access reviews" },
];

export function GovernanceSectionNav({
  active,
  onChange,
}: {
  active: GovernanceSectionId;
  onChange: (id: GovernanceSectionId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Governance sections"
      className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-3"
    >
      {sections.map((section) => {
        const isActive = section.id === active;
        return (
          <button
            key={section.id}
            type="button"
            role="tab"
            id={`governance-tab-${section.id}`}
            aria-selected={isActive}
            aria-controls={`governance-panel-${section.id}`}
            tabIndex={isActive ? 0 : -1}
            className={cn(
              "inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-sm font-semibold",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
              isActive
                ? "bg-[var(--raised)] text-[var(--accent)]"
                : "text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]",
            )}
            onClick={() => onChange(section.id)}
          >
            {section.label}
          </button>
        );
      })}
    </div>
  );
}
