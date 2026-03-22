import { useEffect } from 'react';

interface Shortcut {
  /** Key to listen for (e.g., 's', 'n', 'Escape') */
  key: string;
  /** Modifier keys required */
  ctrl?: boolean;
  meta?: boolean;
  /** Handler to call */
  handler: () => void;
  /** Description shown in UI (optional) */
  label?: string;
}

/**
 * Registers keyboard shortcuts that fire only when no input/textarea/select is focused.
 * Shortcuts with ctrl/meta modifiers fire even when inputs are focused.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    if (shortcuts.length === 0) return;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : true;
        const metaMatch = shortcut.meta ? e.metaKey : true;
        const needsModifier = shortcut.ctrl || shortcut.meta;

        if (keyMatch && ctrlMatch && metaMatch) {
          // Skip non-modifier shortcuts when typing in inputs
          if (isInput && !needsModifier) continue;

          e.preventDefault();
          shortcut.handler();
          return;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
