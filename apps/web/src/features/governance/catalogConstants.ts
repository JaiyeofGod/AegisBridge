import type {
  ControlImplementationStatusValue,
  ControlSortKey,
  PolicyLifecycleStatus,
  PolicySortKey,
  SortDirection,
} from "@/services/api-types";

export const CONTROL_PAGE_SIZE = 25;
export const POLICY_PAGE_SIZE = 25;
export const CONTROL_SELECTOR_PAGE_SIZE = 20;

export const CONTROL_IMPLEMENTATION_STATUSES: {
  value: ControlImplementationStatusValue;
  label: string;
}[] = [
  { value: "planned", label: "Planned" },
  { value: "partial", label: "Partial" },
  { value: "implemented", label: "Implemented" },
  { value: "not_implemented", label: "Not implemented" },
  { value: "not_applicable", label: "Not applicable" },
];

export const CONTROL_SORT_OPTIONS: { value: ControlSortKey; label: string }[] = [
  { value: "id", label: "Control id" },
  { value: "control_code", label: "Control code" },
  { value: "title", label: "Title" },
  { value: "updated_at", label: "Updated" },
  { value: "created_at", label: "Created" },
];

export const POLICY_STATUSES: { value: PolicyLifecycleStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
  { value: "retired", label: "Retired" },
];

export const POLICY_SORT_OPTIONS: { value: PolicySortKey; label: string }[] = [
  { value: "id", label: "Policy id" },
  { value: "title", label: "Title" },
  { value: "updated_at", label: "Updated" },
  { value: "created_at", label: "Created" },
];

export const SORT_DIRECTIONS: { value: SortDirection; label: string }[] = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];

export function totalPages(total: number, pageSize: number): number {
  if (total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}
