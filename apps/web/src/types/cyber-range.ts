export type RangeSectionId = "topology" | "segments" | "scenarios" | "telemetry" | "detections";

/** Documented lab-architecture association. Not live reachability or observed traffic. */
export const catalogRelationshipKinds = [
  "connected_to",
  "depends_on",
  "manages",
  "monitors",
] as const;

export type CatalogRelationshipKind = (typeof catalogRelationshipKinds)[number];
