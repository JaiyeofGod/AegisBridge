import { cn } from "@/lib/cn";
import type { RiskSectionId } from "@/types/risk";

const sections: { id: RiskSectionId; label: string }[] = [
  { id: "register", label: "Risk register" },
  { id: "treatments", label: "Treatment plans" },
  { id: "exceptions", label: "Exceptions" },
  { id: "vendors", label: "Vendor risk" },
];

export function RiskSectionNav({
  active,
  onChange,
}: {
  active: RiskSectionId;
  onChange: (id: RiskSectionId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Risk sections"
      className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-3"
    >
      {sections.map((section) => {
        const isActive = section.id === active;
        return (
          <button
            key={section.id}
            type="button"
            role="tab"
            id={`risk-tab-${section.id}`}
            aria-selected={isActive}
            aria-controls={`risk-panel-${section.id}`}
            tabIndex={isActive ? 0 : -1}
            className={cn(
              "motion-control inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-sm font-semibold",
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
