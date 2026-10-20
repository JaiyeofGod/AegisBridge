import { incidentMock } from "@/mocks/incidents";

export function useIncidentData() {
  return { status: "ready" as const, data: incidentMock };
}
