import { useState } from 'react';
import { ArrowRight, ChevronDown, Equal, AlertTriangle, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import type { SlideshowConfig } from '@/types/slideshow.types';

interface OverrideDiffViewProps {
  globalConfig: SlideshowConfig;
  overrideConfig: SlideshowConfig;
  className?: string;
}

interface DiffRow {
  label: string;
  global: string;
  override: string;
  changed: boolean;
}

const LAYOUT_LABELS: Record<string, string> = {
  'full-rotation': 'Volle Rotation',
  'split-view': 'Split-View',
  'triple-view': 'Triple-View',
  'grid-2x2': '2×2 Grid',
};

const TRANSITION_LABELS: Record<string, string> = {
  fade: 'Fade',
  slide: 'Slide',
  zoom: 'Zoom',
  none: 'Keine',
};

function bool(v: unknown): string {
  return v ? 'Ja' : 'Nein';
}

function buildDiffRows(global: SlideshowConfig, override: SlideshowConfig): DiffRow[] {
  const rows: DiffRow[] = [
    {
      label: 'Layout',
      global: LAYOUT_LABELS[global.layout] || global.layout,
      override: LAYOUT_LABELS[override.layout] || override.layout,
      changed: global.layout !== override.layout,
    },
    {
      label: 'Standard-Dauer',
      global: `${global.defaultDuration}s`,
      override: `${override.defaultDuration}s`,
      changed: global.defaultDuration !== override.defaultDuration,
    },
    {
      label: 'Standard-Übergang',
      global: TRANSITION_LABELS[global.defaultTransition] || global.defaultTransition,
      override: TRANSITION_LABELS[override.defaultTransition] || override.defaultTransition,
      changed: global.defaultTransition !== override.defaultTransition,
    },
    {
      label: 'Übergänge aktiv',
      global: bool(global.enableTransitions),
      override: bool(override.enableTransitions),
      changed: global.enableTransitions !== override.enableTransitions,
    },
    {
      label: 'Slides',
      global: `${global.slides.length} Slides`,
      override: `${override.slides.length} Slides`,
      changed: global.slides.length !== override.slides.length ||
        JSON.stringify(global.slides.map(s => s.id).sort()) !== JSON.stringify(override.slides.map(s => s.id).sort()),
    },
    {
      label: 'Slide-Indikatoren',
      global: bool(global.showSlideIndicators),
      override: bool(override.showSlideIndicators),
      changed: global.showSlideIndicators !== override.showSlideIndicators,
    },
  ];

  return rows;
}

export function OverrideDiffView({ globalConfig, overrideConfig, className }: OverrideDiffViewProps) {
  const rows = buildDiffRows(globalConfig, overrideConfig);
  const changedCount = rows.filter(r => r.changed).length;
  const [expanded, setExpanded] = useState(false);

  if (changedCount === 0) {
    return (
      <div className={clsx('flex items-center gap-2 rounded-xl border border-spa-success/20 bg-spa-success-light/70 px-4 py-2.5 text-sm text-spa-success-dark', className)}>
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="font-medium">Override identisch mit Global</span>
      </div>
    );
  }

  return (
    <div className={clsx('rounded-xl border border-spa-bg-secondary overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 bg-spa-bg-primary/60 border-b border-spa-bg-secondary transition-colors hover:bg-spa-bg-primary"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-spa-info" />
          <span className="text-sm font-semibold text-spa-text-primary">
            Vergleich: Global vs. Override
          </span>
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-spa-info-light text-spa-info-dark">
            {changedCount} Abweichung{changedCount !== 1 ? 'en' : ''}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 text-spa-text-secondary transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="divide-y divide-spa-bg-secondary/60">
          <div className="grid grid-cols-[1fr,1fr,auto,1fr] gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-spa-text-secondary">
            <span>Eigenschaft</span>
            <span>Global</span>
            <span />
            <span>Override</span>
          </div>

          {rows.map((row) => (
            <div
              key={row.label}
              className={clsx(
                'grid grid-cols-[1fr,1fr,auto,1fr] gap-2 px-4 py-2.5 items-center text-sm',
                row.changed && 'bg-spa-info-light/30'
              )}
            >
              <span className="font-medium text-spa-text-primary">{row.label}</span>
              <span className="text-spa-text-secondary">{row.global}</span>
              <span className="shrink-0">
                {row.changed
                  ? <ArrowRight className="w-3.5 h-3.5 text-spa-info" />
                  : <Equal className="w-3.5 h-3.5 text-spa-text-secondary/40" />
                }
              </span>
              <span className={clsx(
                row.changed ? 'font-semibold text-spa-info-dark' : 'text-spa-text-secondary'
              )}>
                {row.override}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
