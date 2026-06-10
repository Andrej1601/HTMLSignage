import type { ReactNode } from 'react';
import { CheckSquare, X } from 'lucide-react';
import { Button } from '@/components/Button';

interface BulkActionBarProps {
  /** Number of currently selected items. The bar renders only when > 0. */
  count: number;
  /** Selects all currently visible items. Omit to hide the "Alle sichtbaren" action. */
  onSelectAll?: () => void;
  /** Disables the "Alle sichtbaren" action (e.g. everything visible is already selected). */
  selectAllDisabled?: boolean;
  /** Clears the current selection. */
  onClear: () => void;
  /** Page-specific action buttons rendered between "Alle sichtbaren" and "Clear". */
  children?: ReactNode;
}

/**
 * Floating bottom toolbar for multi-select bulk actions. Shared between the
 * Users and Media pages — wraps the common chrome (count, "select all visible",
 * clear) around page-specific action buttons passed as children.
 */
export function BulkActionBar({
  count,
  onSelectAll,
  selectAllDisabled,
  onClear,
  children,
}: BulkActionBarProps) {
  if (count <= 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Mehrfach-Aktionen"
      className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-spa-bg-secondary bg-spa-surface px-4 py-3 shadow-2xl"
    >
      <span className="text-sm font-semibold text-spa-text-primary">
        {count} ausgewählt
      </span>
      <div className="mx-2 h-5 w-px bg-spa-bg-secondary" />
      {onSelectAll && (
        <Button
          variant="ghost"
          size="sm"
          icon={CheckSquare}
          onClick={onSelectAll}
          disabled={selectAllDisabled}
        >
          Alle sichtbaren
        </Button>
      )}
      {children}
      <Button
        variant="ghost"
        size="sm"
        icon={X}
        onClick={onClear}
        aria-label="Auswahl aufheben"
      />
    </div>
  );
}
