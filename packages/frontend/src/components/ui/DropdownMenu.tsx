import { useState, type ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';

export interface DropdownMenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'danger';
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

  const handleItemClick = (item: DropdownMenuItem) => {
    item.onClick();
    setOpen(false);
  };

  return (
    <div className="relative">
      {trigger ? (
        <div onClick={() => setOpen((prev) => !prev)}>{trigger(open)}</div>
      ) : (
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="p-2 hover:bg-spa-bg-primary rounded-lg transition-colors"
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
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />

          <div
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
                        onClick={() => handleItemClick(item)}
                        className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                          isDanger
                            ? 'text-red-600 hover:bg-red-50'
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
