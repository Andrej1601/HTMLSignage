import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
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

  const allItems = sections.flat();

  const close = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
    triggerRef.current?.focus();
  }, []);

  const handleItemClick = (item: DropdownMenuItem) => {
    item.onClick();
    if (!item.keepOpen) close();
  };

  // Focus menu item when focusedIndex changes
  useEffect(() => {
    if (!open || focusedIndex < 0) return;
    const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    buttons?.[focusedIndex]?.focus();
  }, [open, focusedIndex]);

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
  }, [open, focusedIndex, allItems, close]);

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
          className="appearance-none bg-transparent border-none p-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spa-primary focus-visible:ring-offset-2 rounded"
        >
          {trigger(open)}
        </button>
      ) : (
        <button
          ref={triggerRef}
          onClick={() => { setOpen((prev) => !prev); if (!open) setFocusedIndex(0); }}
          className="p-2 hover:bg-spa-bg-primary rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spa-primary focus-visible:ring-offset-2"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="menu"
          type="button"
        >
          <MoreVertical className="w-5 h-5 text-spa-text-secondary" aria-hidden="true" />
        </button>
      )}

      {open && (
        <>
          {/* Invisible backdrop to close menu on outside click */}
          <div className="fixed inset-0 z-10" onClick={close} aria-hidden="true" />

          <div
            ref={menuRef}
            role="menu"
            className={`absolute right-0 mt-2 ${width} bg-white rounded-lg shadow-lg border border-spa-bg-secondary z-20`}
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
                        className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-spa-primary ${
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
        </>
      )}
    </div>
  );
}
