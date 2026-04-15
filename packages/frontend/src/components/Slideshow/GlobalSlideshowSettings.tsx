import { Settings, Clock, Timer, Sparkles } from 'lucide-react';
import { SectionCard } from '@/components/SectionCard';
import type { SlideshowConfig } from '@/types/slideshow.types';

interface GlobalSlideshowSettingsProps {
  config: SlideshowConfig;
  prestartMinutes?: number;
  disabled?: boolean;
  onChange: (next: SlideshowConfig) => void;
  onPrestartMinutesChange?: (minutes: number) => void;
}

const TRANSITION_OPTIONS = [
  { value: 'fade', label: 'Einblenden', description: 'Sanftes Überblenden' },
  { value: 'slide', label: 'Schieben', description: 'Horizontaler Übergang' },
  { value: 'zoom', label: 'Zoom', description: 'Vergrößerungs-Effekt' },
  { value: 'none', label: 'Direkt', description: 'Kein Übergang' },
] as const;

export function GlobalSlideshowSettings({
  config,
  prestartMinutes = 10,
  disabled = false,
  onChange,
  onPrestartMinutesChange,
}: GlobalSlideshowSettingsProps) {
  const canEditPrestartMinutes = Boolean(onPrestartMinutesChange);

  return (
    <SectionCard title="Wiedergabe & Timing" icon={Settings}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

        {/* Slide-Dauer */}
        <div className="rounded-xl border border-spa-border bg-spa-bg-primary/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-spa-primary" />
            <label className="text-sm font-semibold text-spa-text-primary">Slide-Dauer</label>
          </div>
          <div className="flex items-baseline gap-2">
            <input
              type="number"
              min="1"
              max="300"
              value={config.defaultDuration}
              onChange={(e) => onChange({ ...config, defaultDuration: parseInt(e.target.value, 10) || 10 })}
              disabled={disabled}
              className="w-20 px-3 py-2.5 border border-spa-border bg-spa-surface text-spa-text-primary rounded-lg focus:outline-hidden focus:ring-2 focus:ring-spa-primary/20 focus:border-spa-primary disabled:opacity-50 text-lg font-semibold text-center"
            />
            <span className="text-sm text-spa-text-secondary">Sekunden</span>
          </div>
          <p className="text-xs text-spa-text-secondary">Dauer pro Slide bevor automatisch weitergeschaltet wird.</p>
        </div>

        {/* Übergang */}
        <div className="rounded-xl border border-spa-border bg-spa-bg-primary/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-spa-primary" />
            <label className="text-sm font-semibold text-spa-text-primary">Übergang</label>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {TRANSITION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...config, defaultTransition: opt.value })}
                disabled={disabled}
                className={`py-2 px-2.5 text-xs font-medium rounded-lg border transition-colors ${
                  config.defaultTransition === opt.value
                    ? 'border-spa-primary bg-spa-primary/10 text-spa-primary'
                    : 'border-spa-border bg-spa-surface text-spa-text-secondary hover:border-spa-primary/40'
                } disabled:opacity-50`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-spa-text-secondary">Effekt beim Wechsel zwischen Slides.</p>
        </div>

        {/* Prestart */}
        {canEditPrestartMinutes && (
          <div className="rounded-xl border border-spa-border bg-spa-bg-primary/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-spa-primary" />
              <label className="text-sm font-semibold text-spa-text-primary">„Gleich"-Vorlauf</label>
            </div>
            <div className="flex items-baseline gap-2">
              <input
                type="number"
                min="0"
                max="120"
                step="1"
                value={prestartMinutes}
                onChange={(e) => {
                  if (!onPrestartMinutesChange) return;
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isFinite(v)) return;
                  onPrestartMinutesChange(Math.min(120, Math.max(0, v)));
                }}
                disabled={disabled}
                className="w-20 px-3 py-2.5 border border-spa-border bg-spa-surface text-spa-text-primary rounded-lg focus:outline-hidden focus:ring-2 focus:ring-spa-primary/20 focus:border-spa-primary disabled:opacity-50 text-lg font-semibold text-center"
              />
              <span className="text-sm text-spa-text-secondary">Minuten</span>
            </div>
            <p className="text-xs text-spa-text-secondary">Ab wann ein Aufguss als „Gleich" angezeigt wird, bevor er beginnt.</p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
