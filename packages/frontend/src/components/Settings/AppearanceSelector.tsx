import type { DisplayAppearance, DesignStyle } from '@/types/settings.types';
import {
  DISPLAY_APPEARANCE_OPTIONS,
  SCHEDULE_DESIGN_STYLE_OPTIONS,
} from '@/config/displayDesignStyles';

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
    <div className="space-y-6">
      <fieldset>
        <legend className="text-lg font-semibold text-spa-text-primary mb-3">Visuelle Aufmachung</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="radiogroup" aria-label="Visuelle Aufmachung">
          {DISPLAY_APPEARANCE_OPTIONS.map((appearance) => (
            <button
              key={appearance.id}
              onClick={() => onDisplayAppearanceChange?.(appearance.id)}
              disabled={!onDisplayAppearanceChange}
              role="radio"
              aria-checked={displayAppearance === appearance.id}
              className={`p-4 border-2 rounded-lg transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spa-accent focus-visible:ring-offset-2 ${
                displayAppearance === appearance.id
                  ? 'border-spa-accent bg-spa-accent/5 shadow-sm'
                  : 'border-spa-secondary/20 hover:border-spa-accent/60'
              }`}
            >
              <div className="font-semibold text-spa-text-primary">{appearance.title}</div>
              <div className="text-xs text-spa-text-secondary mt-1">{appearance.description}</div>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-semibold text-spa-text-primary mb-3">Plan-Darstellung</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="radiogroup" aria-label="Plan-Darstellung">
          {SCHEDULE_DESIGN_STYLE_OPTIONS.map((style) => (
            <button
              key={style.id}
              onClick={() => onDesignStyleChange?.(style.id)}
              disabled={!onDesignStyleChange}
              role="radio"
              aria-checked={designStyle === style.id}
              className={`p-4 border-2 rounded-lg transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spa-accent focus-visible:ring-offset-2 ${
                designStyle === style.id
                  ? 'border-spa-accent bg-spa-accent/5 shadow-sm'
                  : 'border-spa-secondary/20 hover:border-spa-accent/60'
              }`}
            >
              <div className="font-semibold text-spa-text-primary">{style.title}</div>
              <div className="text-xs text-spa-text-secondary mt-1">{style.description}</div>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
