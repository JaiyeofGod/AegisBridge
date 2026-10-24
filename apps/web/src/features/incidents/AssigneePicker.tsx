import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { CatalogPager } from "@/components/navigation/CatalogPager";
import { useAuthActions } from "@/features/auth/useAuthSession";
import { cn } from "@/lib/cn";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { ApiError } from "@/services/api-client";
import type { DirectoryUser } from "@/services/api-types";
import { DIRECTORY_PAGE_SIZE, fetchDirectoryUsers } from "@/services/directory";

type Props = {
  selectedId: string | null;
  selectedLabel: string;
  onSelect: (user: DirectoryUser | null) => void;
  testId: string;
};

const fieldClass =
  "mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]";

function secondaryLine(user: DirectoryUser) {
  return [user.department, user.job_title]
    .filter((part) => part && part.trim().length > 0)
    .join(" · ");
}

export function AssigneePicker({ selectedId, selectedLabel, onSelect, testId }: Props) {
  const { handleAccountUnauthorized } = useAuthActions();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);
  const q = debouncedSearch.trim();
  const directoryQuery = { page, page_size: DIRECTORY_PAGE_SIZE, q };
  const directory = useQuery({
    queryKey: ["directory", "users", directoryQuery],
    queryFn: () =>
      fetchDirectoryUsers({
        page,
        pageSize: DIRECTORY_PAGE_SIZE,
        q: q || undefined,
      }),
    retry: false,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    if (directory.error instanceof ApiError && directory.error.status === 401) {
      void handleAccountUnauthorized(directory.error);
    }
  }, [directory.error, handleAccountUnauthorized]);

  const items = directory.data?.items ?? [];
  const total = directory.data?.total ?? 0;
  const directoryError =
    directory.isError && directory.error instanceof ApiError && directory.error.status === 403
      ? "You do not have access to the operational user directory."
      : directory.isError
        ? "Unable to load assignees."
        : null;

  return (
    <fieldset className="space-y-2" data-testid={testId} aria-busy={directory.isFetching}>
      <legend className="text-xs text-[var(--muted)]">Assignee</legend>
      <p className="text-sm text-[var(--text)]" role="status" data-testid={`${testId}-current`}>
        Current assignee: {selectedLabel}
      </p>
      <label className="block text-xs text-[var(--muted)]">
        Search active users
        <input
          className={fieldClass}
          value={searchInput}
          placeholder="Search active users"
          data-testid={`${testId}-search`}
          onChange={(event) => {
            setSearchInput(event.target.value);
            setPage(1);
          }}
        />
      </label>
      {directory.isFetching ? (
        <p className="text-sm text-[var(--muted)]" role="status">
          Searching users…
        </p>
      ) : null}
      {directoryError ? (
        <p className="text-sm text-[var(--text)]" role="alert" data-testid={`${testId}-error`}>
          {directoryError}
        </p>
      ) : null}
      <div className="space-y-1" role="group" aria-label="Assignee choices">
        <button
          type="button"
          aria-pressed={selectedId === null}
          data-testid={`${testId}-unassigned`}
          className={cn(
            "w-full rounded-[var(--radius-control)] border px-3 py-2 text-left text-sm",
            selectedId === null
              ? "border-[var(--accent)] bg-[var(--canvas)] text-[var(--text)]"
              : "border-[var(--border)] bg-[var(--canvas)] text-[var(--text)]",
          )}
          onClick={() => onSelect(null)}
        >
          Unassigned
        </button>
        {items.map((user) => {
          const selected = selectedId === user.id;
          const detail = secondaryLine(user);
          return (
            <button
              key={user.id}
              type="button"
              aria-pressed={selected}
              data-testid={`${testId}-option-${user.id}`}
              className={cn(
                "w-full rounded-[var(--radius-control)] border px-3 py-2 text-left text-sm",
                selected
                  ? "border-[var(--accent)] bg-[var(--canvas)] text-[var(--text)]"
                  : "border-[var(--border)] bg-[var(--canvas)] text-[var(--text)]",
              )}
              onClick={() => onSelect(user)}
            >
              <span className="block font-medium text-[var(--text)]">{user.display_name}</span>
              <span className="block text-xs text-[var(--muted)]">{user.id}</span>
              {detail ? <span className="block text-xs text-[var(--muted)]">{detail}</span> : null}
            </button>
          );
        })}
      </div>
      {directory.isSuccess && !directory.isFetching && items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No active users match this search.</p>
      ) : null}
      {total > DIRECTORY_PAGE_SIZE ? (
        <CatalogPager
          page={page}
          pageSize={DIRECTORY_PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          disabled={directory.isFetching}
          label="active users"
          testIdPrefix={`${testId}-pager`}
        />
      ) : null}
    </fieldset>
  );
}
