import { LAYOUT_OPTIONS } from '@/types/slideshow.types';
import type { LayoutType } from '@/types/slideshow.types';
import clsx from 'clsx';

interface LayoutPickerProps {
  layout: LayoutType;
  disabled?: boolean;
  onLayoutChange: (layout: LayoutType) => void;
}

export function LayoutPicker({
  layout,
  disabled = false,
  onLayoutChange,
}: LayoutPickerProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-spa-text-primary mb-4">Display Layout</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {LAYOUT_OPTIONS.map((option) => (
          <button
            key={option.type}
            onClick={() => onLayoutChange(option.type)}
            disabled={disabled}
            className={clsx(
              'p-4 rounded-lg border-2 transition-all text-left disabled:opacity-50',
              layout === option.type
                ? 'border-spa-primary bg-spa-primary/5'
                : 'border-spa-bg-secondary hover:border-spa-primary/50'
            )}
          >
            <div className="text-3xl mb-2">{option.icon}</div>
            <div className="font-semibold text-spa-text-primary mb-1">{option.label}</div>
            <div className="text-xs text-spa-text-secondary">{option.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
