import { Button } from "@/components/buttons/Button";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  label?: string;
  testIdPrefix?: string;
};

export function CatalogPager({
  page,
  pageSize,
  total,
  onPageChange,
  disabled = false,
  label = "results",
  testIdPrefix = "catalog-pager",
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const atFirst = safePage <= 1;
  const atLast = safePage >= totalPages || total === 0;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 pt-3"
      data-testid={testIdPrefix}
    >
      <p className="text-xs text-[var(--muted)]" data-testid={`${testIdPrefix}-status`}>
        {total === 0 ? `0 ${label}` : `Page ${safePage} of ${totalPages} · ${total} ${label}`}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          data-testid={`${testIdPrefix}-previous`}
          aria-label="Previous page"
          disabled={disabled || atFirst}
          onClick={() => onPageChange(safePage - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="secondary"
          data-testid={`${testIdPrefix}-next`}
          aria-label="Next page"
          disabled={disabled || atLast}
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
