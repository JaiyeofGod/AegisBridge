import { StatusBadge } from "@/components/status/StatusBadge";
import {
  catalogRelationState,
  directCatalogPeerIds,
  observedTone,
  type CatalogRelationState,
  type LabSystemRelationshipView,
  type LabSystemView,
  type LabZoneView,
} from "@/features/cyber-range/mapCyberRange";

const CATALOG_RELATIONSHIP_NOTE =
  "Catalog relationships describe documented lab architecture. They do not represent live reachability or observed traffic.";

export function RangeTopology({
  zones,
  systems,
  relationships,
  relationshipsKnown,
  selectedId,
  onSelect,
}: {
  zones: LabZoneView[];
  systems: LabSystemView[];
  relationships: LabSystemRelationshipView[];
  relationshipsKnown: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const peers = directCatalogPeerIds(selectedId, relationships);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {zones.map((zone) => (
          <section
            key={zone.id}
            aria-label={`${zone.id} ${zone.cidr}`}
            className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-3"
          >
            <h3 className="font-heading text-sm font-bold text-[var(--text)]">{zone.id}</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">{zone.cidr}</p>
            <ul className="mt-3 space-y-2">
              {systems
                .filter((system) => system.zoneId === zone.id)
                .map((system) => (
                  <li key={system.id}>
                    <SystemSelect
                      system={system}
                      relation={catalogRelationState(
                        system.id,
                        selectedId,
                        peers,
                        relationshipsKnown,
                      )}
                      onSelect={onSelect}
                    />
                  </li>
                ))}
              {systems.every((system) => system.zoneId !== zone.id) ? (
                <li className="text-xs text-[var(--muted)]">
                  No dedicated system in this catalog.
                </li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--text)]">Catalog relationships</h3>
        <p className="mt-1 text-xs text-[var(--muted)]" data-testid="range-relationships">
          {CATALOG_RELATIONSHIP_NOTE} Isolation notes live on each zone. Shared zone membership is
          not a relationship.
        </p>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)]">
        <table className="min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Accessible alternative to the zone diagram. Lab systems with zone, address, telemetry
            status, observed state, and catalog relationship.
          </caption>
          <thead className="bg-[var(--raised)] text-[var(--muted)]">
            <tr>
              {["System", "Zone", "Address", "Role", "Telemetry", "Observed"].map((heading) => (
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
                  <SystemSelect
                    system={system}
                    relation={catalogRelationState(
                      system.id,
                      selectedId,
                      peers,
                      relationshipsKnown,
                    )}
                    onSelect={onSelect}
                    compact
                  />
                </td>
                <td className="px-3 py-3 text-[var(--muted)]">{system.zoneId}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{system.ipAddress}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{system.role}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{system.telemetryLabel}</td>
                <td className="px-3 py-3">
                  <StatusBadge
                    label={system.observedLabel}
                    tone={observedTone(system.observedState)}
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

function SystemSelect({
  system,
  relation,
  onSelect,
  compact = false,
}: {
  system: LabSystemView;
  relation: CatalogRelationState;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={relation === "selected"}
      data-catalog-relation={relation}
      onClick={() => onSelect(system.id)}
      className={
        compact
          ? "motion-catalog-state inline-flex min-h-11 flex-col items-start justify-center rounded-[var(--radius-control)] border border-transparent px-2 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          : "motion-catalog-state flex min-h-11 w-full flex-col items-start justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      }
    >
      <span className="font-medium text-[var(--text)]">{system.hostname}</span>
      <RelationCue relation={relation} />
      {compact ? null : (
        <span className="text-xs text-[var(--muted)]">
          {system.observedLabel} · {system.ipAddress}
        </span>
      )}
    </button>
  );
}

function RelationCue({ relation }: { relation: CatalogRelationState }) {
  if (relation === "selected") {
    return <span className="text-xs font-medium text-[var(--accent)]">Selected</span>;
  }
  if (relation === "related") {
    return <span className="text-xs font-medium text-[var(--text)]">Catalog link</span>;
  }
  return null;
}
