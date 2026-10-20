import { administrationMock } from "@/mocks/administration";

export function useAdministrationData() {
  return { status: "ready" as const, data: administrationMock };
}
