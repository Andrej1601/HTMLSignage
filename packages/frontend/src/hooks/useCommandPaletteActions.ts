import { useEffect } from 'react';
import { useCommandPaletteContext, type CommandItem } from '@/contexts/CommandPaletteContext';

/**
 * Registers context-specific command palette actions while a page/component is mounted.
 * `items` must be stable (useMemo'd by the caller) to avoid re-registering on every render.
 */
export function useCommandPaletteActions(items: CommandItem[]) {
  const { registerItems, unregisterItems } = useCommandPaletteContext();

  useEffect(() => {
    if (items.length === 0) return;
    registerItems(items);
    const ids = items.map((item) => item.id);
    return () => unregisterItems(ids);
  }, [items, registerItems, unregisterItems]);
}
