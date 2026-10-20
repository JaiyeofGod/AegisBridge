import { cyberRangeMock } from "@/mocks/cyber-range";

export function useCyberRangeData() {
  return { status: "ready" as const, data: cyberRangeMock };
}
