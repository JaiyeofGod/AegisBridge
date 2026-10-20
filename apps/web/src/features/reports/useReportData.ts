import { reportsMock } from "@/mocks/reports";

export function useReportData() {
  return { status: "ready" as const, data: reportsMock };
}
