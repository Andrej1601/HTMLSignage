import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  group: string;
  action: () => void;
}

interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  extraItems: CommandItem[];
  registerItems: (items: CommandItem[]) => void;
  unregisterItems: (ids: string[]) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
  extraItems: [],
  registerItems: () => {},
  unregisterItems: () => {},
});

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [itemMap, setItemMap] = useState<Map<string, CommandItem>>(new Map());

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const registerItems = useCallback((items: CommandItem[]) => {
    setItemMap((prev) => {
      const next = new Map(prev);
      for (const item of items) next.set(item.id, item);
      return next;
    });
  }, []);

  const unregisterItems = useCallback((ids: string[]) => {
    setItemMap((prev) => {
      const next = new Map(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  const extraItems = Array.from(itemMap.values());

  return (
    <CommandPaletteContext.Provider
      value={{ isOpen, open, close, toggle, extraItems, registerItems, unregisterItems }}
    >
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPaletteContext() {
  return useContext(CommandPaletteContext);
}
