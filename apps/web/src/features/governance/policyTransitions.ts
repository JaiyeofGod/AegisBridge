import type { PolicyLifecycleStatus } from "@/services/api-types";

export type PolicyTransitionOption = {
  toStatus: PolicyLifecycleStatus;
  label: string;
  permission: "policy.manage" | "policy.approve";
  requiresVersion: boolean;
  needsConfirm: "publish" | "retire" | null;
};

/** Client-side affordances mirroring backend transition rules. Server remains authoritative. */
export function allowedPolicyTransitions(
  status: PolicyLifecycleStatus,
  canManage: boolean,
  canApprove: boolean,
): PolicyTransitionOption[] {
  const options: PolicyTransitionOption[] = [];
  function add(option: PolicyTransitionOption) {
    if (option.permission === "policy.manage" && !canManage) return;
    if (option.permission === "policy.approve" && !canApprove) return;
    options.push(option);
  }

  if (status === "draft") {
    add({
      toStatus: "in_review",
      label: "Submit for review",
      permission: "policy.manage",
      requiresVersion: false,
      needsConfirm: null,
    });
  }
  if (status === "in_review") {
    add({
      toStatus: "draft",
      label: "Return to draft",
      permission: "policy.manage",
      requiresVersion: false,
      needsConfirm: null,
    });
    add({
      toStatus: "approved",
      label: "Approve",
      permission: "policy.approve",
      requiresVersion: false,
      needsConfirm: null,
    });
  }
  if (status === "approved") {
    add({
      toStatus: "in_review",
      label: "Return to review",
      permission: "policy.manage",
      requiresVersion: false,
      needsConfirm: null,
    });
    add({
      toStatus: "published",
      label: "Publish version",
      permission: "policy.approve",
      requiresVersion: true,
      needsConfirm: "publish",
    });
  }
  if (status === "published") {
    add({
      toStatus: "published",
      label: "Publish replacement draft",
      permission: "policy.approve",
      requiresVersion: true,
      needsConfirm: "publish",
    });
    add({
      toStatus: "retired",
      label: "Retire policy",
      permission: "policy.approve",
      requiresVersion: false,
      needsConfirm: "retire",
    });
  }
  return options;
}
