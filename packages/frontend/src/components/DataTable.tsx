import { useState, useMemo, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

export interface Column<T> {
  key: string;
  header: string;
  /** Render function for the cell content */
  render: (item: T) => ReactNode;
  /** Render function for mobile card view (defaults to render) */
  renderMobile?: (item: T) => ReactNode;
  /** Sort function — if provided, column is sortable */
  sortFn?: (a: T, b: T) => number;
  /** CSS class for the header/cell */
  className?: string;
  /** Align right (e.g. for action columns) */
  alignRight?: boolean;
  /** Hide in mobile card view */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  /** Unique key extractor */
  keyFn: (item: T) => string;
  /** Mobile card title extractor */
  mobileTitle?: (item: T) => ReactNode;
  /** Optional empty state */
  emptyState?: ReactNode;
  /** Items per page. When set, pagination is enabled. */
  pageSize?: number;
}

type SortDir = 'asc' | 'desc';

export function DataTable<T>({
  data,
  columns,
  keyFn,
  mobileTitle,
  emptyState,
  pageSize,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortFn) return data;
    const sorted = [...data].sort(col.sortFn);
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [data, columns, sortKey, sortDir]);

  const totalPages = pageSize ? Math.max(1, Math.ceil(sortedData.length / pageSize)) : 1;
  const safePageIndex = Math.min(page, totalPages - 1);

  const pagedData = useMemo(() => {
    if (!pageSize) return sortedData;
    const start = safePageIndex * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, pageSize, safePageIndex]);

  // Reset page when data changes
  useMemo(() => { setPage(0); }, [data.length]);

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const paginationBar = pageSize && totalPages > 1 && (
    <div className="flex items-center justify-between px-4 py-3 text-sm text-spa-text-secondary">
      <span>
        {safePageIndex * pageSize + 1}–{Math.min((safePageIndex + 1) * pageSize, sortedData.length)} von {sortedData.length}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={safePageIndex === 0}
          className="p-1.5 rounded-lg hover:bg-spa-bg-primary disabled:opacity-30 transition-colors"
          aria-label="Vorherige Seite"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-2 font-medium text-spa-text-primary">
          {safePageIndex + 1} / {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={safePageIndex >= totalPages - 1}
          className="p-1.5 rounded-lg hover:bg-spa-bg-primary disabled:opacity-30 transition-colors"
          aria-label="Nächste Seite"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-spa-bg-secondary">
            <thead className="bg-spa-bg-primary">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={clsx(
                      'px-6 py-3 text-xs font-medium text-spa-text-secondary uppercase tracking-wider',
                      col.alignRight ? 'text-right' : 'text-left',
                      col.className,
                    )}
                  >
                    {col.sortFn ? (
                      <button
                        onClick={() => handleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-spa-text-primary transition-colors group"
                      >
                        {col.header}
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-spa-bg-secondary">
              {pagedData.map((item) => (
                <tr key={keyFn(item)} className="hover:bg-spa-bg-primary transition-colors">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        'px-6 py-4 whitespace-nowrap text-sm',
                        col.alignRight && 'text-right',
                        col.className,
                      )}
                    >
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {paginationBar}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {pagedData.map((item) => (
          <div
            key={keyFn(item)}
            className="bg-white rounded-lg shadow-sm border border-spa-bg-secondary p-4"
          >
            {mobileTitle && (
              <div className="font-semibold text-spa-text-primary mb-3">
                {mobileTitle(item)}
              </div>
            )}
            <div className="space-y-2">
              {columns
                .filter((col) => !col.hideOnMobile)
                .map((col) => (
                  <div key={col.key} className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-spa-text-secondary uppercase">
                      {col.header}
                    </span>
                    <div className="text-sm text-spa-text-primary text-right">
                      {col.renderMobile ? col.renderMobile(item) : col.render(item)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
        {paginationBar}
      </div>
    </>
  );
}
