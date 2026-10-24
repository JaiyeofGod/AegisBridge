import { apiGet } from "@/services/api-client";
import type { DirectoryUser, DirectoryUserListQuery, PageResponse } from "@/services/api-types";

export const DIRECTORY_PAGE_SIZE = 20;

export function fetchDirectoryUsers(query: DirectoryUserListQuery = {}) {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? DIRECTORY_PAGE_SIZE));
  const q = query.q?.trim();
  if (q) params.set("q", q);
  return apiGet<PageResponse<DirectoryUser>>(`/api/v1/directory/users?${params.toString()}`);
}
