import type { DisplayAppearance, DesignStyle } from '@/types/settings.types';
import {
  DISPLAY_APPEARANCE_OPTIONS,
  SCHEDULE_DESIGN_STYLE_OPTIONS,
} from '@/config/displayDesignStyles';
import { Layers, LayoutGrid, AlignLeft, BookOpen, Clock, List } from 'lucide-react';

const APPEARANCE_ICONS: Record<string, typeof Layers> = {
  'wellness-stage': Layers,
  'editorial-resort': BookOpen,
};

const STYLE_ICONS: Record<string, typeof LayoutGrid> = {
  'modern-wellness': LayoutGrid,
  'modern-timeline': Clock,
  'compact-tiles': List,
};

interface AppearanceSelectorProps {
  displayAppearance?: DisplayAppearance;
  designStyle?: DesignStyle;
  onDisplayAppearanceChange?: (appearance: DisplayAppearance) => void;
  onDesignStyleChange?: (style: DesignStyle) => void;
}

export function AppearanceSelector({
  displayAppearance,
  designStyle,
  onDisplayAppearanceChange,
  onDesignStyleChange,
}: AppearanceSelectorProps) {
  return (
    <div className="space-y-5">
      {/* Display Appearance */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3">
          Visuelle Aufmachung
        </label>
        <div className="space-y-2" role="radiogroup" aria-label="Visuelle Aufmachung">
          {DISPLAY_APPEARANCE_OPTIONS.map((option) => {
            const Icon = APPEARANCE_ICONS[option.id] ?? AlignLeft;
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
                    : 'border-stone-100 hover:border-spa-primary/30 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`p-1.5 rounded-lg ${isActive ? 'bg-spa-primary/10 text-spa-primary' : 'bg-stone-100 text-stone-400'}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${isActive ? 'text-spa-primary' : 'text-stone-700'}`}>
                      {option.title}
                    </p>
                    <p className="text-[10px] text-stone-400 mt-0.5">{option.description}</p>
                  </div>
                </div>
                <span className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${
                  isActive ? 'border-spa-primary bg-spa-primary' : 'border-stone-300'
                }`}>
                  {isActive && <span className="block w-full h-full rounded-full scale-50 bg-white" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Schedule Design Style */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3">
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
                    : 'border-stone-100 hover:border-spa-primary/30 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`p-1.5 rounded-lg ${isActive ? 'bg-spa-primary/10 text-spa-primary' : 'bg-stone-100 text-stone-400'}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${isActive ? 'text-spa-primary' : 'text-stone-700'}`}>
                      {option.title}
                    </p>
                    <p className="text-[10px] text-stone-400 mt-0.5">{option.description}</p>
                  </div>
                </div>
                <span className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${
                  isActive ? 'border-spa-primary bg-spa-primary' : 'border-stone-300'
                }`}>
                  {isActive && <span className="block w-full h-full rounded-full scale-50 bg-white" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
