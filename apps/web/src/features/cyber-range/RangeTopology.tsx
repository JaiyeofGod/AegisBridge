import { StatusBadge } from "@/components/status/StatusBadge";
import type { LabRelationship, LabSegment, LabSystem } from "@/types/cyber-range";

const kindHint: Record<LabRelationship["kind"], string> = {
  Telemetry: "Solid label · simulated snapshot",
  Logging: "Solid label · gateway to SIEM",
  Policy: "Deny label · not a connection",
  Hypothetical: "Dashed label · not observed",
};

export function RangeTopology({
  segments,
  systems,
  relationships,
  selectedId,
  onSelect,
}: {
  segments: LabSegment[];
  systems: LabSystem[];
  relationships: LabRelationship[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {segments.map((segment) => (
          <section
            key={segment.id}
            aria-label={`${segment.id} ${segment.cidr}`}
            className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-3"
          >
            <h3 className="font-heading text-sm font-bold text-[var(--text)]">{segment.id}</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">{segment.cidr}</p>
            <ul className="mt-3 space-y-2">
              {systems
                .filter((system) => system.zone === segment.id)
                .map((system) => (
                  <li key={system.id}>
                    <button
                      type="button"
                      aria-pressed={selectedId === system.id}
                      onClick={() => onSelect(system.id)}
                      className="flex min-h-11 w-full flex-col items-start justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    >
                      <span className="font-medium text-[var(--text)]">{system.hostname}</span>
                      <span className="text-xs text-[var(--muted)]">
                        {system.state} · {system.address}
                      </span>
                    </button>
                  </li>
                ))}
              {systems.every((system) => system.zone !== segment.id) ? (
                <li className="text-xs text-[var(--muted)]">
                  No dedicated system in this snapshot.
                </li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--text)]">Relationships</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Type is written on every row. Line style is a hint, not the only signal.
        </p>
        <ul className="mt-3 space-y-2">
          {relationships.map((link) => (
            <li
              key={link.id}
              className="rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-3 text-sm"
            >
              <p className="font-medium text-[var(--text)]">
                {link.kind} · {link.from} → {link.to}
              </p>
              <p className="mt-1 text-[var(--muted)]">
                {kindHint[link.kind]}. {link.detail}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)]">
        <table className="min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Accessible alternative to the zone diagram. Lab systems with zone, address, telemetry,
            and state. Relationship type is in the list above, not color alone.
          </caption>
          <thead className="bg-[var(--raised)] text-[var(--muted)]">
            <tr>
              {["System", "Zone", "Address", "Role", "Telemetry", "State"].map((heading) => (
                <th key={heading} scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {systems.map((system) => (
              <tr key={system.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-3">
                  <button
                    type="button"
                    aria-pressed={selectedId === system.id}
                    onClick={() => onSelect(system.id)}
                    className="inline-flex min-h-11 items-center font-medium text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    {system.hostname}
                  </button>
                </td>
                <td className="px-3 py-3 text-[var(--muted)]">{system.zone}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{system.address}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{system.role}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{system.telemetry}</td>
                <td className="px-3 py-3">
                  <StatusBadge
                    label={system.state}
                    tone={system.state === "Reporting" ? "success" : "warning"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
