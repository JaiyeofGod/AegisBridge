import { socMock } from "@/mocks/soc";

export function useSocData() {
  return { status: "ready" as const, data: socMock };
}
