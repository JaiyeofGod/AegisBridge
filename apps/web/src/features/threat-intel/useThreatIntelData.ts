import { threatIntelMock } from "@/mocks/threat-intel";

export function useThreatIntelData() {
  return { status: "ready" as const, data: threatIntelMock };
}
