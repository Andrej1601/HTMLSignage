import { getLayout, LAYOUT_OPTIONS } from '@/types/slideshow.types';
import type { LayoutType, SlideshowConfig } from '@/types/slideshow.types';
import clsx from 'clsx';

interface LayoutPickerProps {
  layout: LayoutType;
  persistentZonePosition?: SlideshowConfig['persistentZonePosition'];
  persistentZoneSize?: number;
  disabled?: boolean;
  onLayoutChange: (layout: LayoutType) => void;
  onPersistentZonePositionChange: (position: NonNullable<SlideshowConfig['persistentZonePosition']>) => void;
  onPersistentZoneSizeChange: (size: number) => void;
}

export function LayoutPicker({
  layout,
  persistentZonePosition,
  persistentZoneSize,
  disabled = false,
  onLayoutChange,
  onPersistentZonePositionChange,
  onPersistentZoneSizeChange,
}: LayoutPickerProps) {
  const currentLayout = getLayout(layout);

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

      {currentLayout.supportsPersistentZone && (
        <div className="mt-4 p-4 bg-spa-bg-primary rounded-lg">
          <h4 className="font-semibold text-spa-text-primary mb-3">Layout-Einstellungen</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Persistente Zone Position
              </label>
              <select
                value={persistentZonePosition || 'left'}
                onChange={(event) =>
                  onPersistentZonePositionChange(
                    event.target.value as NonNullable<SlideshowConfig['persistentZonePosition']>
                  )
                }
                disabled={disabled}
                className="w-full px-3 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary disabled:opacity-50"
              >
                <option value="left">Links</option>
                <option value="right">Rechts</option>
                <option value="top">Oben</option>
                <option value="bottom">Unten</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Zone Größe ({persistentZoneSize || 50}%)
              </label>
              <input
                type="range"
                min="30"
                max="70"
                value={persistentZoneSize || 50}
                onChange={(event) => onPersistentZoneSizeChange(parseInt(event.target.value, 10))}
                disabled={disabled}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
