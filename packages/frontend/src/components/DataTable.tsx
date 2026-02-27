import { useState, useMemo, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
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
}

type SortDir = 'asc' | 'desc';

export function DataTable<T>({
  data,
  columns,
  keyFn,
  mobileTitle,
  emptyState,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortFn) return data;
    const sorted = [...data].sort(col.sortFn);
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [data, columns, sortKey, sortDir]);

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

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
              {sortedData.map((item) => (
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
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {sortedData.map((item) => (
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
      </div>
    </>
  );
}
