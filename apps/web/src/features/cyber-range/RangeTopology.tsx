import { useId, useLayoutEffect, useRef, useState } from "react";

import { StatusBadge } from "@/components/status/StatusBadge";
import {
  anchorOnBox,
  boxCenter,
  endpointPairKey,
  offsetsForBundle,
  stableOffset,
  type Box,
} from "@/features/cyber-range/catalogEdges";
import {
  catalogEdgeCaption,
  catalogEdgeShowsArrow,
  catalogEdgeTouchesSelection,
  catalogRelationState,
  directCatalogPeerIds,
  observedTone,
  type CatalogRelationState,
  type LabSystemRelationshipView,
  type LabSystemView,
  type LabZoneView,
} from "@/features/cyber-range/mapCyberRange";
import type { CatalogRelationshipKind } from "@/types/cyber-range";

const CATALOG_RELATIONSHIP_NOTE =
  "Catalog relationships describe documented lab architecture. They do not represent live reachability or observed traffic.";

type DrawnEdge = {
  id: string;
  kind: CatalogRelationshipKind;
  sourceSystemId: string;
  targetSystemId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  emphasis: "direct" | "baseline";
  showArrow: boolean;
};

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
  const frameRef = useRef<HTMLDivElement>(null);
  const markerId = `catalog-edge-arrow-${useId().replace(/:/g, "")}`;
  const [frameSize, setFrameSize] = useState({ width: 1, height: 1 });
  const [edges, setEdges] = useState<DrawnEdge[]>([]);
  const visibleRelationships = relationships.filter((item) => bothSystemsVisible(item, systems));
  const hostnameById = new Map(systems.map((system) => [system.id, system.hostname]));

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || !relationshipsKnown) {
      setEdges([]);
      return;
    }
    const measure = () => {
      const rect = frame.getBoundingClientRect();
      setFrameSize({
        width: Math.max(rect.width, 1),
        height: Math.max(rect.height, 1),
      });
      setEdges(
        measureCatalogEdges(
          frame,
          relationships.filter((item) => bothSystemsVisible(item, systems)),
          selectedId,
        ),
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [relationships, relationshipsKnown, selectedId, systems]);

  return (
    <div className="space-y-6">
      <div ref={frameRef} className="relative">
        <svg
          className="catalog-edge-layer pointer-events-none absolute inset-0 overflow-visible"
          width={frameSize.width}
          height={frameSize.height}
          viewBox={`0 0 ${frameSize.width} ${frameSize.height}`}
          aria-hidden="true"
          data-testid="catalog-edge-layer"
        >
          <defs>
            <marker
              id={markerId}
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,0 L7,3.5 L0,7 Z" />
            </marker>
          </defs>
          {edges.map((edge) => (
            <line
              key={edge.id}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              className="catalog-edge"
              data-relationship-id={edge.id}
              data-relationship-kind={edge.kind}
              data-source-system-id={edge.sourceSystemId}
              data-target-system-id={edge.targetSystemId}
              data-edge-emphasis={edge.emphasis}
              markerEnd={edge.showArrow ? `url(#${markerId})` : undefined}
            />
          ))}
        </svg>
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
                        topologyNode
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
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--text)]">Catalog relationships</h3>
        <p className="mt-1 text-xs text-[var(--muted)]" data-testid="range-relationships">
          {CATALOG_RELATIONSHIP_NOTE} Isolation notes live on each zone. Shared zone membership is
          not a relationship. Each line above is one stored relationship. An arrowhead points from
          the documented source to the documented target. A connected-to line has no arrowhead. The
          list names the relationship kind.
        </p>
        <CatalogEdgeList
          relationships={visibleRelationships}
          relationshipsKnown={relationshipsKnown}
          hostnameById={hostnameById}
        />
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

function CatalogEdgeList({
  relationships,
  relationshipsKnown,
  hostnameById,
}: {
  relationships: LabSystemRelationshipView[];
  relationshipsKnown: boolean;
  hostnameById: ReadonlyMap<string, string>;
}) {
  if (!relationshipsKnown) {
    return <p className="mt-2 text-xs text-[var(--muted)]">Updating catalog relationships…</p>;
  }
  if (relationships.length === 0) {
    return <p className="mt-2 text-xs text-[var(--text)]">No catalog relationships are stored.</p>;
  }
  return (
    <ul className="mt-2 space-y-1 text-xs text-[var(--text)]" data-testid="catalog-edge-list">
      {relationships.map((item) => (
        <li key={item.id}>{catalogEdgeCaption(item, hostnameById)}</li>
      ))}
    </ul>
  );
}

function SystemSelect({
  system,
  relation,
  onSelect,
  compact = false,
  topologyNode = false,
}: {
  system: LabSystemView;
  relation: CatalogRelationState;
  onSelect: (id: string) => void;
  compact?: boolean;
  topologyNode?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={relation === "selected"}
      data-catalog-relation={relation}
      data-topology-node={topologyNode ? system.id : undefined}
      onClick={() => onSelect(system.id)}
      className={
        compact
          ? "motion-catalog-state inline-flex min-h-11 flex-col items-start justify-center rounded-[var(--radius-control)] border border-transparent px-2 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          : "motion-catalog-state relative z-[1] flex min-h-11 w-full flex-col items-start justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
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

function bothSystemsVisible(
  relationship: LabSystemRelationshipView,
  systems: LabSystemView[],
): boolean {
  const ids = new Set(systems.map((system) => system.id));
  return ids.has(relationship.sourceSystemId) && ids.has(relationship.targetSystemId);
}

function measureCatalogEdges(
  frame: HTMLElement,
  relationships: LabSystemRelationshipView[],
  selectedId: string,
): DrawnEdge[] {
  const groups = new Map<string, LabSystemRelationshipView[]>();
  for (const item of relationships) {
    const key = endpointPairKey(item.sourceSystemId, item.targetSystemId);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  const drawn: DrawnEdge[] = [];
  for (const group of groups.values()) {
    const offsets = offsetsForBundle(group.length);
    group.forEach((item, index) => {
      const source = frame.querySelector<HTMLElement>(
        `[data-topology-node="${CSS.escape(item.sourceSystemId)}"]`,
      );
      const target = frame.querySelector<HTMLElement>(
        `[data-topology-node="${CSS.escape(item.targetSystemId)}"]`,
      );
      if (!source || !target) return;
      const sourceBox = relativeBox(frame, source);
      const targetBox = relativeBox(frame, target);
      const sourceCenter = boxCenter(sourceBox);
      const targetCenter = boxCenter(targetBox);
      const sideways = stableOffset(
        item.sourceSystemId,
        item.targetSystemId,
        sourceCenter,
        targetCenter,
        offsets[index] ?? 0,
      );
      const start = anchorOnBox(sourceBox, targetCenter);
      const end = anchorOnBox(targetBox, sourceCenter);
      drawn.push({
        id: item.id,
        kind: item.kind,
        sourceSystemId: item.sourceSystemId,
        targetSystemId: item.targetSystemId,
        x1: start.x + sideways.x,
        y1: start.y + sideways.y,
        x2: end.x + sideways.x,
        y2: end.y + sideways.y,
        emphasis: catalogEdgeTouchesSelection(item, selectedId) ? "direct" : "baseline",
        showArrow: catalogEdgeShowsArrow(item.kind),
      });
    });
  }
  return drawn;
}

function relativeBox(frame: HTMLElement, node: HTMLElement): Box {
  const frameRect = frame.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  return {
    left: rect.left - frameRect.left,
    top: rect.top - frameRect.top,
    width: rect.width,
    height: rect.height,
  };
}
