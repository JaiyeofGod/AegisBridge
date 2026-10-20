import { useQuery } from "@tanstack/react-query";

import {
  fetchAccessReviews,
  fetchAdministrationSummary,
  fetchAuditEvents,
  fetchIntegrations,
  fetchRoles,
  fetchUsers,
} from "@/services/administration";

export function useAdministrationSummary() {
  return useQuery({
    queryKey: ["administration", "summary"],
    queryFn: fetchAdministrationSummary,
    retry: false,
    staleTime: 30_000,
  });
}

export function useIntegrations() {
  return useQuery({
    queryKey: ["administration", "integrations"],
    queryFn: fetchIntegrations,
    retry: false,
    staleTime: 30_000,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["administration", "users"],
    queryFn: fetchUsers,
    retry: false,
    staleTime: 30_000,
  });
}

export function useAdminRoles() {
  return useQuery({
    queryKey: ["administration", "roles"],
    queryFn: fetchRoles,
    retry: false,
    staleTime: 30_000,
  });
}

export function useAuditEvents() {
  return useQuery({
    queryKey: ["administration", "audit-events"],
    queryFn: fetchAuditEvents,
    retry: false,
    staleTime: 30_000,
  });
}

export function useAccessReviews() {
  return useQuery({
    queryKey: ["administration", "access-reviews"],
    queryFn: fetchAccessReviews,
    retry: false,
    staleTime: 30_000,
  });
}
