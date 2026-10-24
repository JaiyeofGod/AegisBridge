import { useDeferredValue, useEffect, useState } from "react";

import { CatalogPager } from "@/components/navigation/CatalogPager";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { StatusBadge } from "@/components/status/StatusBadge";
import { useAuthActions } from "@/features/auth/useAuthSession";
import {
  useAttackTactics,
  useAttackTechnique,
  useAttackTechniques,
} from "@/features/threat-intel/useAttackCatalog";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import { ApiError } from "@/services/api-client";
import type {
  AttackTechniqueDetail,
  AttackTechniqueListItem,
  AttackTechniqueParent,
} from "@/services/api-types";

const PAGE_SIZE = 25;

const fieldClass =
  "min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

export function AttackExplorer() {
  const { handleAccountUnauthorized } = useAuthActions();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [tactic, setTactic] = useState("");
  const [page, setPage] = useState(1);
  const [includeSubtechniques, setIncludeSubtechniques] = useState(true);
  const [includeDeprecated, setIncludeDeprecated] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const tactics = useAttackTactics(includeDeprecated);
  const techniques = useAttackTechniques({
    page,
    pageSize: PAGE_SIZE,
    q: deferredSearch || undefined,
    tactic: tactic || undefined,
    includeSubtechniques,
    includeDeprecated,
  });
  const items = techniques.data?.items ?? [];
  const detailId = selectedId || items[0]?.id || "";
  const detail = useAttackTechnique(detailId);
  const release = items[0]?.release ?? tactics.data?.[0]?.release ?? null;

  useEffect(() => {
    if (tactics.error instanceof ApiError && tactics.error.status === 401) {
      void handleAccountUnauthorized(tactics.error);
    }
  }, [handleAccountUnauthorized, tactics.error]);

  useEffect(() => {
    if (techniques.error instanceof ApiError && techniques.error.status === 401) {
      void handleAccountUnauthorized(techniques.error);
    }
  }, [handleAccountUnauthorized, techniques.error]);

  useEffect(() => {
    if (detail.error instanceof ApiError && detail.error.status === 401) {
      void handleAccountUnauthorized(detail.error);
    }
  }, [detail.error, handleAccountUnauthorized]);

  function resetPage() {
    setPage(1);
    setSelectedId("");
  }

  const catalogError = techniques.isError
    ? techniques.error
    : tactics.isError
      ? tactics.error
      : null;
  const detailRecord = detail.data && detail.data.id === detailId ? detail.data : null;

  return (
    <section className="space-y-4" data-testid="attack-explorer" aria-labelledby="attack-heading">
      <header className="space-y-2">
        <h2 id="attack-heading" className="font-heading text-xl font-bold text-[var(--text)]">
          MITRE ATT&CK
        </h2>
        <p className="text-sm text-[var(--text)]">Enterprise technique catalog</p>
        <p className="max-w-3xl text-sm text-[var(--muted)]">
          Browse the Enterprise tactics and techniques used to categorize adversary behavior.
        </p>
        <p className="text-sm text-[var(--text)]" data-testid="attack-release">
          {release ? `Pinned Enterprise ATT&CK ${release}` : "Pinned Enterprise release"}
        </p>
        <p className="text-xs text-[var(--muted)]">
          Read-only catalog. This is not a live feed and does not generate detections.
        </p>
      </header>

      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
        <div className="min-w-[220px] flex-1">
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="attack-search"
          >
            Search ATT&CK id or name
          </label>
          <input
            id="attack-search"
            type="search"
            maxLength={80}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
            placeholder="T1059 or technique name"
            className={cn(fieldClass, "w-full placeholder:text-[var(--muted)]")}
          />
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="attack-tactic"
          >
            Tactic
          </label>
          <select
            id="attack-tactic"
            className={cn(fieldClass, "min-w-[220px]")}
            value={tactic}
            onChange={(event) => {
              setTactic(event.target.value);
              resetPage();
            }}
          >
            <option value="">All tactics</option>
            {(tactics.data ?? []).map((item) => (
              <option key={item.id} value={item.short_name}>
                {item.name} · {item.id}
              </option>
            ))}
          </select>
        </div>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--text)]">
          <input
            type="checkbox"
            checked={includeSubtechniques}
            onChange={(event) => {
              setIncludeSubtechniques(event.target.checked);
              resetPage();
            }}
          />
          Show sub-techniques
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--muted)]">
          <input
            type="checkbox"
            checked={includeDeprecated}
            onChange={(event) => {
              setIncludeDeprecated(event.target.checked);
              resetPage();
            }}
          />
          Show deprecated / revoked
        </label>
      </div>

      {includeDeprecated ? (
        <p className="text-xs text-[var(--muted)]">
          Revoked and deprecated objects are included. Open a technique to see its status.
        </p>
      ) : null}

      {techniques.isPending ? <LoadingState label="Loading ATT&CK catalog" rows={4} /> : null}
      {catalogError && !(catalogError instanceof ApiError && catalogError.status === 401) ? (
        <ErrorState
          title={catalogTitle(catalogError)}
          description={catalogDescription(catalogError)}
          onRetry={() => {
            void techniques.refetch();
            void tactics.refetch();
          }}
        />
      ) : null}

      {techniques.isSuccess ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start">
          <div className="min-w-0">
            {items.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No ATT&CK techniques match these filters.
              </p>
            ) : (
              <TechniqueList items={items} selectedId={detailId} onSelect={setSelectedId} />
            )}
            <CatalogPager
              page={techniques.data.page}
              pageSize={techniques.data.page_size}
              total={techniques.data.total}
              onPageChange={setPage}
              disabled={techniques.isFetching}
              label="techniques"
              testIdPrefix="attack-pager"
            />
          </div>
          <TechniqueDetail
            techniqueId={detailId}
            record={detailRecord}
            loading={detail.isFetching && !detailRecord}
            error={detail.error}
            onRetry={() => void detail.refetch()}
            onSelect={setSelectedId}
          />
        </div>
      ) : null}
    </section>
  );
}

function TechniqueList({
  items,
  selectedId,
  onSelect,
}: {
  items: AttackTechniqueListItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)] md:block">
        <table className="min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Enterprise ATT&CK techniques with id, name, tactics, and type
          </caption>
          <thead className="bg-[var(--raised)] text-[var(--muted)]">
            <tr>
              {["ATT&CK ID", "Technique", "Tactics", "Type"].map((heading) => (
                <th key={heading} scope="col" className="px-3 py-3 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <TechniqueButton
                    item={item}
                    selected={selectedId === item.id}
                    onSelect={onSelect}
                  />
                </td>
                <td className="px-3 py-2 text-[var(--text)]">{item.name}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{item.tactics.join(", ")}</td>
                <td className="px-3 py-2 text-[var(--text)]">
                  {techniqueType(item.is_subtechnique)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-pressed={selectedId === item.id}
              className="flex min-h-11 w-full flex-col gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <span className="font-mono text-sm font-semibold text-[var(--text)]">
                {item.id}
                {selectedId === item.id ? <span className="sr-only">, selected</span> : null}
              </span>
              <span className="text-sm text-[var(--text)]">{item.name}</span>
              <span className="text-xs text-[var(--muted)]">
                {item.tactics.join(", ")} · {techniqueType(item.is_subtechnique)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function TechniqueButton({
  item,
  selected,
  onSelect,
}: {
  item: AttackTechniqueListItem;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-11 items-center font-mono text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
        selected ? "text-[var(--accent)]" : "text-[var(--text)]",
      )}
    >
      {item.id}
      {selected ? <span className="sr-only">, selected</span> : null}
    </button>
  );
}

function TechniqueDetail({
  techniqueId,
  record,
  loading,
  error,
  onRetry,
  onSelect,
}: {
  techniqueId: string;
  record: AttackTechniqueDetail | null;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <section
      className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6"
      aria-labelledby="attack-detail-heading"
      data-testid="attack-detail"
    >
      <h3 id="attack-detail-heading" className="font-heading text-lg text-[var(--text)]">
        Technique detail
      </h3>
      {!techniqueId ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No technique is selected.</p>
      ) : null}
      {loading ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Loading technique detail.</p>
      ) : null}
      {error instanceof ApiError && error.status !== 401 ? (
        <div className="mt-3">
          <ErrorState
            title={error.status === 404 ? "Technique not found" : catalogTitle(error)}
            description={
              error.status === 404
                ? "This ATT&CK id is not in the active catalog."
                : catalogDescription(error)
            }
            onRetry={onRetry}
          />
        </div>
      ) : null}
      {record ? <DetailBody record={record} onSelect={onSelect} /> : null}
    </section>
  );
}

function DetailBody({
  record,
  onSelect,
}: {
  record: AttackTechniqueDetail;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-4 space-y-4 text-sm">
      <div>
        <p className="font-mono text-base font-semibold text-[var(--text)]">{record.id}</p>
        <h4 className="mt-1 font-heading text-base text-[var(--text)]">{record.name}</h4>
      </div>
      <p className="text-[var(--text)]">{techniqueType(record.is_subtechnique)}</p>
      <div className="flex flex-wrap gap-2">
        {record.revoked ? <StatusBadge label="Revoked" tone="critical" /> : null}
        {record.deprecated ? <StatusBadge label="Deprecated" tone="warning" /> : null}
        {!record.revoked && !record.deprecated ? (
          <StatusBadge label="Not revoked or deprecated" tone="neutral" />
        ) : null}
      </div>
      {record.parent ? <ParentTechnique parent={record.parent} onSelect={onSelect} /> : null}
      <div>
        <p className="text-[var(--muted)]">Tactics</p>
        {record.tactics.length === 0 ? (
          <p className="mt-1 text-[var(--text)]">No tactic membership is stored.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {record.tactics.map((item) => (
              <li key={item.id} className="text-[var(--text)]">
                {item.name} · {item.short_name} · {item.id}
              </li>
            ))}
          </ul>
        )}
      </div>
      {record.platforms.length > 0 ? (
        <div>
          <p className="text-[var(--muted)]">Platforms</p>
          <p className="mt-1 text-[var(--text)]">{record.platforms.join(", ")}</p>
        </div>
      ) : null}
      <div>
        <p className="text-[var(--muted)]">Description</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-[var(--text)]">
          {record.description ?? "No description is stored."}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Modified</p>
        <p className="mt-1 text-[var(--text)]">
          {record.modified_at ? formatTimestamp(record.modified_at) : "Not recorded"}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Source release</p>
        <p className="mt-1 text-[var(--text)]">Pinned Enterprise ATT&CK {record.release}</p>
      </div>
    </div>
  );
}

function ParentTechnique({
  parent,
  onSelect,
}: {
  parent: AttackTechniqueParent;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-[var(--muted)]">Parent</p>
      <button
        type="button"
        className="mt-1 inline-flex min-h-11 items-center font-semibold text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        onClick={() => onSelect(parent.id)}
      >
        Parent: {parent.id} — {parent.name}
      </button>
    </div>
  );
}

function techniqueType(isSubtechnique: boolean) {
  return isSubtechnique ? "Sub-technique" : "Technique";
}

function catalogTitle(error: unknown) {
  if (error instanceof ApiError && error.status === 403) return "ATT&CK catalog restricted";
  return "Unable to load the ATT&CK catalog";
}

function catalogDescription(error: unknown) {
  if (error instanceof ApiError && error.status === 403) {
    return "You do not have permission to read the ATT&CK catalog.";
  }
  return "The ATT&CK catalog request failed. Retry to load it again.";
}
