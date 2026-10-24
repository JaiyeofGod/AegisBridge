import { describe, expect, it } from "vitest";

import {
  aegisConfidenceLabel,
  dataOriginLabel,
  indicatorSubtypeLabel,
  mapIndicator,
  mapIndicatorDetail,
  safeReferenceUrl,
} from "@/features/threat-intel/mapThreatIntel";
import type { IndicatorDetailResponse, IndicatorListItem } from "@/services/api-types";

const threatFox: IndicatorListItem = {
  id: "IOC-9001",
  indicator_type: "ip",
  value: "198.51.100.8",
  confidence: null,
  severity: null,
  source: { id: "SRC-0004", name: "ThreatFox", connection_status: "healthy" },
  first_seen: "2026-10-24T11:00:00Z",
  last_seen: "2026-10-24T12:00:00Z",
  status: "active",
  internal_match: false,
  attack_technique_id: null,
  matched_asset_id: null,
};

const urlhaus: IndicatorDetailResponse = {
  id: "IOC-9002",
  indicator_type: "url",
  value: "https://evil.example/a",
  confidence: null,
  severity: null,
  source: { id: "SRC-0005", name: "URLhaus", connection_status: "healthy" },
  first_seen: "2026-10-24T11:00:00Z",
  last_seen: "2026-10-24T12:00:00Z",
  status: "active",
  internal_match: false,
  attack_technique_id: null,
  matched_asset_id: null,
  summary: "URLhaus observation.",
  attack: null,
  matched_asset: null,
  data_origin: "external_feed",
  indicator_subtype: "url",
  threat_type: "malware_download",
  malware_family: null,
  tags: ["elf", "<script>alert(1)</script>"],
  source_status: "online",
  source_confidence: null,
  reference_url: "https://urlhaus.abuse.ch/url/9/",
  fetched_at: "2026-10-24T12:06:00Z",
};

describe("indicator provenance mapping", () => {
  it("keeps ThreatFox source confidence separate from a missing AegisBridge label", () => {
    const detail = mapIndicatorDetail({
      ...threatFox,
      summary: "ThreatFox observation.",
      attack: null,
      matched_asset: null,
      data_origin: "external_feed",
      indicator_subtype: "ipv4",
      threat_type: "botnet_cc",
      malware_family: "Dridex",
      tags: ["exe"],
      source_status: null,
      source_confidence: 75,
      reference_url: "https://threatfox.abuse.ch/ioc/1",
      fetched_at: "2026-10-24T12:05:00Z",
    });
    expect(detail.sourceName).toBe("ThreatFox");
    expect(detail.indicatorTypeLabel).toBe("IP");
    expect(detail.indicatorSubtypeLabel).toBe("IPv4");
    expect(detail.dataOriginLabel).toBe("External feed");
    expect(detail.confidenceLabel).toBe("Not assigned");
    expect(detail.sourceConfidence).toBe(75);
    expect(detail.malwareFamily).toBe("Dridex");
    expect(detail.tags).toEqual(["exe"]);
    expect(detail.fetchedAt).not.toBeNull();
    expect(detail.referenceUrl).toBe("https://threatfox.abuse.ch/ioc/1");
  });

  it("maps a URLhaus row without turning source status into a confidence label", () => {
    const detail = mapIndicatorDetail(urlhaus);
    expect(detail.sourceName).toBe("URLhaus");
    expect(detail.indicatorSubtypeLabel).toBe("URL");
    expect(detail.feedStatus).toBe("online");
    expect(detail.confidenceLabel).toBe("Not assigned");
    expect(detail.sourceConfidence).toBeNull();
    expect(detail.tags).toContain("<script>alert(1)</script>");
    expect(detail.dataOrigin).toBe("external_feed");
  });

  it("does not invent enrichment for a simulated row", () => {
    const detail = mapIndicatorDetail({
      ...threatFox,
      id: "IOC-0001",
      confidence: "low",
      source: {
        id: "SRC-0006",
        name: "Internal simulated set",
        connection_status: "reference_only",
      },
      summary: "Simulated development indicator.",
      attack: null,
      matched_asset: null,
      data_origin: "simulated",
    });
    expect(dataOriginLabel(detail.dataOrigin)).toBe("Simulated");
    expect(detail.malwareFamily).toBeNull();
    expect(detail.feedStatus).toBeNull();
    expect(detail.sourceConfidence).toBeNull();
    expect(detail.tags).toEqual([]);
    expect(detail.fetchedAt).toBeNull();
    expect(mapIndicator(threatFox).confidenceLabel).toBe("Not assigned");
    expect(aegisConfidenceLabel("medium")).toBe("Medium");
    expect(indicatorSubtypeLabel("sha256")).toBe("SHA-256");
    expect(safeReferenceUrl("javascript:alert(1)")).toBeNull();
    expect(safeReferenceUrl("https://urlhaus.abuse.ch/url/9/")).toBe(
      "https://urlhaus.abuse.ch/url/9/",
    );
  });
});
