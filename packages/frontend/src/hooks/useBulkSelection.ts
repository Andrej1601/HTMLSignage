import { useCallback, useMemo, useState } from 'react';

export interface BulkSelection<T> {
  selectedIds: Set<string>;
  selectedCount: number;
  /** Currently-visible items that are selected. */
  selectedItems: T[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
  /** Selects every currently-visible item. */
  selectAllVisible: () => void;
  /** True when every visible item is selected (and there is at least one). */
  allVisibleSelected: boolean;
  /** True when some — but not all — visible items are selected. */
  someVisibleSelected: boolean;
  setSelectedIds: (next: Set<string>) => void;
}

/**
 * Multi-select state for a list of items keyed by `id`. The selection is pruned
 * to the currently-visible `items` during render, so anything that scrolls out
 * of the active filter automatically leaves the selection. Shared by the Users
 * and Media pages (previously hand-rolled in each).
 */
export function useBulkSelection<T extends { id: string }>(items: T[]): BulkSelection<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // Render-phase sync (no setState-in-effect): when the visible set changes,
  // drop any selected ids that are no longer visible.
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    if (selectedIds.size > 0) {
      const visibleIds = new Set(items.map((item) => item.id));
      const filtered = new Set<string>();
      for (const id of selectedIds) {
        if (visibleIds.has(id)) filtered.add(id);
      }
      if (filtered.size !== selectedIds.size) setSelectedIds(filtered);
    }
  }

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, [items]);

  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.id));
  const someVisibleSelected =
    items.some((item) => selectedIds.has(item.id)) && !allVisibleSelected;

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    selectedItems,
    isSelected,
    toggle,
    clear,
    selectAllVisible,
    allVisibleSelected,
    someVisibleSelected,
    setSelectedIds,
  };
}
