import type { OverviewMetric } from "@/types/overview";

export type IndicatorType = "IP" | "Domain" | "URL" | "File hash";

export type IntelConfidence = "High" | "Medium" | "Low";

export type IntelFreshness = "Current" | "Expiring" | "Stale";

export type IntelSectionId = "indicators" | "advisories" | "enrichment" | "sources" | "attack";

export type SourceConnection = "Simulated snapshot" | "Pinned reference" | "Planned";

export type ThreatIndicator = {
  id: string;
  indicatorId: string;
  intelId: string;
  type: IndicatorType;
  value: string;
  source: string;
  confidence: IntelConfidence;
  relevance: "High" | "Medium" | "Low";
  firstSeen: string;
  lastSeen: string;
  freshness: IntelFreshness;
  freshnessDetail: string;
  relatedCve: string | null;
  relatedAsset: string | null;
  assetSlug: string | null;
  relatedRecord: string | null;
  attackMapping: string | null;
  status: string;
  analystContext: string;
};

export type ThreatAdvisory = {
  id: string;
  advisoryId: string;
  intelId: string;
  title: string;
  source: string;
  confidence: IntelConfidence;
  relevance: "High" | "Medium" | "Low";
  freshness: IntelFreshness;
  relatedCve: string | null;
  relatedAsset: string | null;
  relatedRecord: string | null;
  attackMapping: string | null;
  status: string;
  analystContext: string;
};

export type EnrichmentLink = {
  id: string;
  intelId: string;
  summary: string;
  targets: string;
};

export type IntelSource = {
  id: string;
  name: string;
  purpose: string;
  connection: SourceConnection;
  freshness: string;
  note: string;
};

export type ThreatIntelSnapshot = {
  dataClassification: "SIMULATED";
  generatedAt: string;
  lastSuccessfulFetchAt: string;
  environmentLabel: string;
  snapshotLabel: string;
  metrics: OverviewMetric[];
  indicators: ThreatIndicator[];
  advisories: ThreatAdvisory[];
  enrichment: EnrichmentLink[];
  sources: IntelSource[];
  workflowNotes: string[];
};
