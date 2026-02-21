import type { SlideshowConfig } from '@/types/slideshow.types';

interface GlobalSlideshowSettingsProps {
  config: SlideshowConfig;
  disabled?: boolean;
  onChange: (next: SlideshowConfig) => void;
}

export function GlobalSlideshowSettings({ config, disabled = false, onChange }: GlobalSlideshowSettingsProps) {
  return (
    <div className="p-6 border-t border-spa-bg-secondary bg-spa-bg-primary/30">
      <h4 className="font-semibold text-spa-text-primary mb-4">Globale Einstellungen</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-spa-text-primary mb-2">
            Standard-Dauer (Sekunden)
          </label>
          <input
            type="number"
            min="1"
            max="300"
            value={config.defaultDuration}
            onChange={(event) => {
              onChange({ ...config, defaultDuration: parseInt(event.target.value, 10) || 10 });
            }}
            disabled={disabled}
            className="w-full px-3 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-spa-text-primary mb-2">
            Standard-Übergang
          </label>
          <select
            value={config.defaultTransition}
            onChange={(event) => {
              onChange({
                ...config,
                defaultTransition: event.target.value as SlideshowConfig['defaultTransition'],
              });
            }}
            disabled={disabled}
            className="w-full px-3 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary disabled:opacity-50"
          >
            <option value="fade">Fade</option>
            <option value="slide">Slide</option>
            <option value="zoom">Zoom</option>
            <option value="none">Keine</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.showSlideIndicators !== false}
              onChange={(event) => {
                onChange({ ...config, showSlideIndicators: event.target.checked });
              }}
              disabled={disabled}
              className="w-4 h-4 text-spa-primary border-gray-300 rounded focus:ring-spa-primary disabled:opacity-50"
            />
            <span className="text-sm font-medium text-spa-text-primary">
              Slide-Indikatoren anzeigen
            </span>
          </label>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.showZoneBorders !== false}
              onChange={(event) => {
                onChange({ ...config, showZoneBorders: event.target.checked });
              }}
              disabled={disabled}
              className="w-4 h-4 text-spa-primary border-gray-300 rounded focus:ring-spa-primary disabled:opacity-50"
            />
            <span className="text-sm font-medium text-spa-text-primary">
              Trennlinien anzeigen
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
