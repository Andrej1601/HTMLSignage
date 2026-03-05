import { Settings, Clock, Layers } from 'lucide-react';
import { SectionCard } from '@/components/SectionCard';
import type { SlideshowConfig } from '@/types/slideshow.types';

interface GlobalSlideshowSettingsProps {
  config: SlideshowConfig;
  prestartMinutes?: number;
  disabled?: boolean;
  onChange: (next: SlideshowConfig) => void;
  onPrestartMinutesChange?: (minutes: number) => void;
}

export function GlobalSlideshowSettings({
  config,
  prestartMinutes = 10,
  disabled = false,
  onChange,
  onPrestartMinutesChange,
}: GlobalSlideshowSettingsProps) {
  const canEditPrestartMinutes = Boolean(onPrestartMinutesChange);

  return (
    <SectionCard title="Globale Einstellungen" icon={Settings}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Timing & Transitions */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-spa-text-primary flex items-center gap-2">
            <Clock className="w-4 h-4 text-spa-text-secondary" />
            Timing & Übergang
          </h4>
          <div className="rounded-lg border border-spa-bg-secondary p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-1.5">
                Standard-Dauer
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={config.defaultDuration}
                  onChange={(event) => {
                    onChange({ ...config, defaultDuration: parseInt(event.target.value, 10) || 10 });
                  }}
                  disabled={disabled}
                  className="w-24 px-3 py-2 border border-spa-bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-spa-primary disabled:opacity-50 text-sm"
                />
                <span className="text-sm text-spa-text-secondary">Sekunden</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-1.5">
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
                className="w-full px-3 py-2 border border-spa-bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-spa-primary disabled:opacity-50 text-sm"
              >
                <option value="fade">Fade</option>
                <option value="slide">Slide</option>
                <option value="zoom">Zoom</option>
                <option value="none">Keine</option>
              </select>
            </div>
            {canEditPrestartMinutes && (
              <div>
                <label className="block text-sm font-medium text-spa-text-primary mb-1.5">
                  „GLEICH" ab (Min vor Start)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="120"
                    step="1"
                    value={prestartMinutes}
                    onChange={(event) => {
                      if (!onPrestartMinutesChange) return;
                      const nextValue = parseInt(event.target.value, 10);
                      if (!Number.isFinite(nextValue)) return;
                      onPrestartMinutesChange(Math.min(120, Math.max(0, nextValue)));
                    }}
                    disabled={disabled}
                    className="w-24 px-3 py-2 border border-spa-bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-spa-primary disabled:opacity-50 text-sm"
                  />
                  <span className="text-sm text-spa-text-secondary">Minuten</span>
                </div>
                <p className="mt-1 text-xs text-spa-text-secondary">
                  Zeitfenster für den Status „GLEICH".
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Display Options */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-spa-text-primary flex items-center gap-2">
            <Layers className="w-4 h-4 text-spa-text-secondary" />
            Darstellung
          </h4>
          <div className="rounded-lg border border-spa-bg-secondary p-4 space-y-4">
            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-spa-bg-primary/50 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={config.showSlideIndicators !== false}
                onChange={(event) => {
                  onChange({ ...config, showSlideIndicators: event.target.checked });
                }}
                disabled={disabled}
                className="w-4 h-4 text-spa-primary border-gray-300 rounded focus:ring-spa-primary disabled:opacity-50"
              />
              <div>
                <span className="text-sm font-medium text-spa-text-primary block">
                  Slide-Indikatoren anzeigen
                </span>
                <span className="text-xs text-spa-text-secondary">
                  Zeigt Punkte zur Navigation zwischen Slides an.
                </span>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-spa-bg-primary/50 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={config.showZoneBorders !== false}
                onChange={(event) => {
                  onChange({ ...config, showZoneBorders: event.target.checked });
                }}
                disabled={disabled}
                className="w-4 h-4 text-spa-primary border-gray-300 rounded focus:ring-spa-primary disabled:opacity-50"
              />
              <div>
                <span className="text-sm font-medium text-spa-text-primary block">
                  Trennlinien anzeigen
                </span>
                <span className="text-xs text-spa-text-secondary">
                  Zeigt visuelle Trennlinien zwischen Layout-Zonen an.
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
