import { accountMock } from "@/mocks/account";

export function useAccountData() {
  return { status: "ready" as const, data: accountMock };
}
