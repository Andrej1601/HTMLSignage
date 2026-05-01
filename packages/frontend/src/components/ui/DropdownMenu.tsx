import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

export interface DropdownMenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'danger';
  /** When true the menu stays open after clicking this item (useful for toggles). */
  keepOpen?: boolean;
}

/** A group of items separated by a divider from the next group. */
export type DropdownMenuSection = DropdownMenuItem[];

interface DropdownMenuProps {
  /** Groups of items; adjacent groups are automatically separated by a divider. */
  sections: DropdownMenuSection[];
  /** Accessible label for the trigger button. */
  ariaLabel?: string;
  /** Tailwind width class for the dropdown panel, e.g. 'w-48' or 'w-56'. */
  width?: string;
  /** Custom trigger element. Defaults to a MoreVertical icon button. */
  trigger?: (open: boolean) => ReactNode;
}

/**
 * Reusable dropdown menu with backdrop, dividers between sections, and
 * danger-variant support. Replaces the hand-rolled menus in DeviceCard,
 * MediaCard, and SaunaCard.
 */
export function DropdownMenu({
  sections,
  ariaLabel = 'Aktionen',
  width = 'w-48',
  trigger,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Berechnete Position für das Portal-gerenderte Menü. Wird beim
  // Öffnen, Scrollen und Resize aktualisiert, damit das Menü selbst
  // bei langen Listen oder gescrolltem Container „kleben" bleibt.
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const allItems = sections.flat();

  const close = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
    setMenuPosition(null);
    triggerRef.current?.focus();
  }, []);

  const handleItemClick = useCallback((item: DropdownMenuItem) => {
    item.onClick();
    if (!item.keepOpen) close();
  }, [close]);

  // Focus menu item when focusedIndex changes
  useEffect(() => {
    if (!open || focusedIndex < 0) return;
    const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    buttons?.[focusedIndex]?.focus();
  }, [open, focusedIndex]);

  // Position berechnen, sobald Menü geöffnet wird. Wir richten das
  // Menü rechts-bündig zum Trigger aus (so wie die alte CSS-Variante)
  // und unter dem Trigger. Wenn der Platz nach unten nicht reicht,
  // klappt das Menü nach oben.
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;
    const triggerRect = trigger.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight ?? 0;
    const menuWidth = menu?.offsetWidth ?? 192; // sinnvoller Default für w-48
    const margin = 8;

    let top = triggerRect.bottom + margin;
    if (menuHeight > 0 && top + menuHeight > window.innerHeight - margin) {
      // unten zu wenig Platz → über dem Trigger anzeigen
      const flipped = triggerRect.top - margin - menuHeight;
      if (flipped >= margin) top = flipped;
    }

    let left = triggerRect.right - menuWidth;
    if (left < margin) left = margin;
    if (left + menuWidth > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - menuWidth - margin);
    }

    setMenuPosition({ top, left });
  }, []);

  // Initiale Position via Ref-Callback statt useLayoutEffect: React
  // ruft den Callback auf, sobald das Menü-DOM-Element gemountet ist.
  // Das ist eine "external sync"-Operation aus React-Linter-Sicht und
  // damit kein setState-in-effect.
  const positionMenuRef = useCallback((node: HTMLDivElement | null) => {
    menuRef.current = node;
    if (node) updatePosition();
  }, [updatePosition]);

  // Auf Scroll/Resize neu positionieren, solange das Menü offen ist.
  // Handler-Aufrufe sind asynchron (vom Browser getriggert) und damit
  // legitime „external state changes" — kein setState-in-effect-Issue.
  useEffect(() => {
    if (!open) return;
    const handler = () => updatePosition();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, { capture: true });
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, { capture: true } as EventListenerOptions);
    };
  }, [open, updatePosition]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % allItems.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + allItems.length) % allItems.length);
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(allItems.length - 1);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < allItems.length) {
          handleItemClick(allItems[focusedIndex]);
        }
        break;
    }
  }, [open, focusedIndex, allItems, close, handleItemClick]);

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      {trigger ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => { setOpen((prev) => !prev); if (!open) setFocusedIndex(0); }}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="menu"
          className="appearance-none bg-transparent border-none p-0 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spa-primary focus-visible:ring-offset-2 rounded"
        >
          {trigger(open)}
        </button>
      ) : (
        <button
          ref={triggerRef}
          onClick={() => { setOpen((prev) => !prev); if (!open) setFocusedIndex(0); }}
          className="p-2 hover:bg-spa-bg-primary rounded-lg transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spa-primary focus-visible:ring-offset-2"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="menu"
          type="button"
        >
          <MoreVertical className="w-5 h-5 text-spa-text-secondary" aria-hidden="true" />
        </button>
      )}

      {open && typeof document !== 'undefined' &&
        createPortal(
          <>
            {/* Invisible backdrop to close menu on outside click */}
            <div
              className="fixed inset-0 z-[60]"
              onClick={close}
              onContextMenu={(e) => { e.preventDefault(); close(); }}
              aria-hidden="true"
            />

            <div
              ref={positionMenuRef}
              role="menu"
              onKeyDown={handleKeyDown}
              style={{
                position: 'fixed',
                // Bis Position berechnet ist außerhalb des Viewports
                // platzieren — verhindert kurzes „Aufpoppen" oben links.
                top: menuPosition?.top ?? -9999,
                left: menuPosition?.left ?? -9999,
                visibility: menuPosition ? 'visible' : 'hidden',
              }}
              className={`${width} bg-spa-surface rounded-lg shadow-lg border border-spa-bg-secondary z-[70]`}
            >
              <div className="py-1">
                {sections.map((section, sectionIndex) => (
                  <div key={sectionIndex}>
                    {sectionIndex > 0 && (
                      <div className="border-t border-spa-bg-secondary my-1" role="separator" />
                    )}
                    {section.map((item) => {
                      const Icon = item.icon;
                      const isDanger = item.variant === 'danger';
                      return (
                        <button
                          key={item.label}
                          role="menuitem"
                          type="button"
                          tabIndex={-1}
                          onClick={() => handleItemClick(item)}
                          className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-spa-primary ${
                            isDanger
                              ? 'text-spa-error hover:bg-spa-error-light'
                              : 'text-spa-text-primary hover:bg-spa-bg-primary'
                          }`}
                        >
                          <Icon className="w-4 h-4" aria-hidden="true" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
