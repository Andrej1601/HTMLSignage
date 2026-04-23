import type {
  DisplayAppearance,
  DesignStyle,
  SaunaDetailStyle,
} from '@/types/settings.types';
import {
  DISPLAY_APPEARANCE_OPTIONS,
  SAUNA_DETAIL_STYLE_OPTIONS,
  SCHEDULE_DESIGN_STYLE_OPTIONS,
} from '@/config/displayDesignStyles';
import {
  Layers,
  LayoutGrid,
  BookOpen,
  Flame,
  Gem,
  Clock,
  List,
  Columns,
  Image as ImageIcon,
  Smartphone,
} from 'lucide-react';

const APPEARANCE_ICONS: Record<string, typeof Layers> = {
  'aurora-thermal': Flame,
  'wellness-stage': Layers,
  'editorial-resort': BookOpen,
  'mineral-noir': Gem,
};

const STYLE_ICONS: Record<string, typeof LayoutGrid> = {
  'modern-wellness': LayoutGrid,
  'modern-timeline': Clock,
  'compact-tiles': List,
};

const SAUNA_DETAIL_ICONS: Record<string, typeof Columns> = {
  split: Columns,
  hero: ImageIcon,
  portrait: Smartphone,
};

interface AppearanceSelectorProps {
  displayAppearance?: DisplayAppearance;
  designStyle?: DesignStyle;
  saunaDetailStyle?: SaunaDetailStyle;
  onDisplayAppearanceChange?: (appearance: DisplayAppearance) => void;
  onDesignStyleChange?: (style: DesignStyle) => void;
  onSaunaDetailStyleChange?: (style: SaunaDetailStyle) => void;
}

export function AppearanceSelector({
  displayAppearance,
  designStyle,
  saunaDetailStyle,
  onDisplayAppearanceChange,
  onDesignStyleChange,
  onSaunaDetailStyleChange,
}: AppearanceSelectorProps) {
  return (
    <div className="space-y-5">
      {/* Display Appearance */}
      <div className="bg-spa-surface rounded-xl border border-spa-border p-4 shadow-xs">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-text-secondary mb-3">
          Bühne
        </label>
        <div className="space-y-2" role="radiogroup" aria-label="Bühne">
          {DISPLAY_APPEARANCE_OPTIONS.map((option) => {
            const Icon = APPEARANCE_ICONS[option.id] ?? Gem;
            const isActive = displayAppearance === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onDisplayAppearanceChange?.(option.id)}
                disabled={!onDisplayAppearanceChange}
                role="radio"
                aria-checked={isActive}
                className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spa-primary focus-visible:ring-offset-2 ${
                  isActive
                    ? 'border-spa-primary bg-spa-primary/5'
                    : 'border-spa-border hover:border-spa-primary/30 hover:bg-spa-bg-secondary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`p-1.5 rounded-lg ${isActive ? 'bg-spa-primary/10 text-spa-primary' : 'bg-spa-bg-secondary text-spa-text-secondary'}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${isActive ? 'text-spa-primary' : 'text-spa-text-primary'}`}>
                      {option.title}
                    </p>
                    <p className="text-[10px] text-spa-text-secondary mt-0.5">{option.description}</p>
                  </div>
                </div>
                <span className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${
                  isActive ? 'border-spa-primary bg-spa-primary' : 'border-spa-border'
                }`}>
                  {isActive && <span className="block w-full h-full rounded-full scale-50 bg-spa-surface" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Schedule Design Style */}
      <div className="bg-spa-surface rounded-xl border border-spa-border p-4 shadow-xs">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-text-secondary mb-3">
          Plan-Darstellung
        </label>
        <div className="space-y-2" role="radiogroup" aria-label="Plan-Darstellung">
          {SCHEDULE_DESIGN_STYLE_OPTIONS.map((option) => {
            const Icon = STYLE_ICONS[option.id] ?? LayoutGrid;
            const isActive = designStyle === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onDesignStyleChange?.(option.id)}
                disabled={!onDesignStyleChange}
                role="radio"
                aria-checked={isActive}
                className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spa-primary focus-visible:ring-offset-2 ${
                  isActive
                    ? 'border-spa-primary bg-spa-primary/5'
                    : 'border-spa-border hover:border-spa-primary/30 hover:bg-spa-bg-secondary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`p-1.5 rounded-lg ${isActive ? 'bg-spa-primary/10 text-spa-primary' : 'bg-spa-bg-secondary text-spa-text-secondary'}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${isActive ? 'text-spa-primary' : 'text-spa-text-primary'}`}>
                      {option.title}
                    </p>
                    <p className="text-[10px] text-spa-text-secondary mt-0.5">{option.description}</p>
                  </div>
                </div>
                <span className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${
                  isActive ? 'border-spa-primary bg-spa-primary' : 'border-spa-border'
                }`}>
                  {isActive && <span className="block w-full h-full rounded-full scale-50 bg-spa-surface" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sauna-Detail (Aufguss-Fokus) Style */}
      <div className="bg-spa-surface rounded-xl border border-spa-border p-4 shadow-xs">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-text-secondary mb-3">
          Aufguss-Fokus
        </label>
        <div className="space-y-2" role="radiogroup" aria-label="Aufguss-Fokus">
          {SAUNA_DETAIL_STYLE_OPTIONS.map((option) => {
            const Icon = SAUNA_DETAIL_ICONS[option.id] ?? Columns;
            const isActive = saunaDetailStyle === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSaunaDetailStyleChange?.(option.id)}
                disabled={!onSaunaDetailStyleChange}
                role="radio"
                aria-checked={isActive}
                className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spa-primary focus-visible:ring-offset-2 ${
                  isActive
                    ? 'border-spa-primary bg-spa-primary/5'
                    : 'border-spa-border hover:border-spa-primary/30 hover:bg-spa-bg-secondary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`p-1.5 rounded-lg ${isActive ? 'bg-spa-primary/10 text-spa-primary' : 'bg-spa-bg-secondary text-spa-text-secondary'}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${isActive ? 'text-spa-primary' : 'text-spa-text-primary'}`}>
                      {option.title}
                    </p>
                    <p className="text-[10px] text-spa-text-secondary mt-0.5">{option.description}</p>
                  </div>
                </div>
                <span className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${
                  isActive ? 'border-spa-primary bg-spa-primary' : 'border-spa-border'
                }`}>
                  {isActive && <span className="block w-full h-full rounded-full scale-50 bg-spa-surface" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
