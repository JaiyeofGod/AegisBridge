import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { invalidateAdministrationWrites } from "@/features/administration/admin-mutations";
import { Button } from "@/components/buttons/Button";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { ApiError } from "@/services/api-client";
import { replaceUserRoles } from "@/services/administration";
import type { UserRolesUpdate } from "@/services/api-types";

/** Seven-role catalog only. Matches backend SEVEN_ROLES. */
export const SEVEN_ROLES = [
  "Administrator",
  "CISO",
  "GRC Analyst",
  "SOC Analyst",
  "Security Engineer",
  "Auditor",
  "Read Only",
] as const;

type Props = {
  userId: string;
  roleNames: string[];
  updatedAt: string | null;
  canManageRoles: boolean;
};

function sortedUnique(roles: string[]) {
  return Array.from(new Set(roles)).sort((a, b) => a.localeCompare(b));
}

export function UserRolesEditor({ userId, roleNames, updatedAt, canManageRoles }: Props) {
  const queryClient = useQueryClient();
  const { handleAccountUnauthorized } = useAuthActions();
  const [draftRoles, setDraftRoles] = useState(() => sortedUnique(roleNames));
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    setDraftRoles(sortedUnique(roleNames));
    setConflict(false);
    setErrorMessage(null);
  }, [userId, roleNames, updatedAt]);

  function restore() {
    setDraftRoles(sortedUnique(roleNames));
    setErrorMessage(null);
    setSuccessMessage(null);
    setConflict(false);
  }

  function toggleRole(role: string) {
    setDraftRoles((current) => {
      if (current.includes(role)) {
        return current.filter((name) => name !== role);
      }
      return sortedUnique([...current, role]);
    });
    setSuccessMessage(null);
  }

  const save = useMutation({
    mutationFn: async () => {
      const next = sortedUnique(draftRoles);
      if (next.length === 0) {
        throw new ApiError("Select at least one role.", 400, "no_roles");
      }
      const current = sortedUnique(roleNames);
      if (next.join("|") === current.join("|")) {
        throw new ApiError("No role changes to save.", 400, "no_changes");
      }
      const body: UserRolesUpdate = { roles: next };
      if (updatedAt) {
        body.expected_updated_at = updatedAt;
      }
      return replaceUserRoles(userId, body);
    },
    onSuccess: async () => {
      setSuccessMessage("User roles updated.");
      setErrorMessage(null);
      setConflict(false);
      await invalidateAdministrationWrites(queryClient);
    },
    onError: async (error) => {
      setSuccessMessage(null);
      if (await handleAccountUnauthorized(error)) {
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setConflict(true);
          setErrorMessage(
            error.message ||
              "This role change conflicts with administrative safety rules or a concurrent update.",
          );
          return;
        }
        if (error.status === 403) {
          setErrorMessage("You do not have permission to assign roles.");
          return;
        }
        if (error.status === 404) {
          setErrorMessage("This user was not found.");
          return;
        }
        if (error.status === 422) {
          setErrorMessage(error.message || "Role assignment is invalid.");
          return;
        }
        if (error.code === "no_changes" || error.code === "no_roles") {
          setErrorMessage(error.message);
          return;
        }
        setErrorMessage(error.message || "User roles could not be saved.");
        return;
      }
      setErrorMessage("User roles could not be saved.");
    },
  });

  if (!canManageRoles) {
    return (
      <div className="space-y-2" data-testid="user-roles-editor-readonly">
        <p className="text-sm text-[var(--text)]">
          {roleNames.length > 0 ? roleNames.join(", ") : "No role stored"}
        </p>
        <p className="text-xs text-[var(--muted)]">
          Role assignment requires the user.role.manage permission. Permissions cannot be edited
          directly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="user-roles-editor">
      <fieldset>
        <legend className="text-xs text-[var(--muted)]">Assigned roles</legend>
        <ul className="mt-2 space-y-2">
          {SEVEN_ROLES.map((role) => (
            <li key={role}>
              <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={draftRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                  data-testid={`user-role-${role.replaceAll(" ", "-").toLowerCase()}`}
                />
                {role}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <p className="text-xs text-[var(--muted)]">
        Only the seven-role catalog is available. Custom roles and direct permission assignment are
        not supported.
      </p>
      {successMessage ? (
        <p className="text-sm text-[var(--accent)]" data-testid="user-roles-success" role="status">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-[var(--danger)]" data-testid="user-roles-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          data-testid="user-roles-save"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save roles"}
        </Button>
        <Button type="button" variant="secondary" disabled={save.isPending} onClick={restore}>
          Cancel
        </Button>
        {conflict ? (
          <Button
            type="button"
            variant="secondary"
            data-testid="user-roles-reload"
            onClick={() => {
              void invalidateAdministrationWrites(queryClient);
              setConflict(false);
              setErrorMessage(null);
            }}
          >
            Reload
          </Button>
        ) : null}
      </div>
    </div>
  );
}
