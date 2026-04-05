import type {
  ThemeColors,
  DesignStyle,
  ColorPaletteName,
  DisplayAppearance,
} from '@/types/settings.types';
import { generateDashboardColors } from '@/types/settings.types';
import { AppearanceSelector } from './AppearanceSelector';
import { PaletteSelector } from './PaletteSelector';
import { ColorTokenEditor } from './ColorTokenEditor';

interface ThemeEditorProps {
  theme: ThemeColors;
  displayAppearance?: DisplayAppearance;
  designStyle?: DesignStyle;
  colorPalette?: ColorPaletteName;
  onChange: (theme: ThemeColors) => void;
  onDisplayAppearanceChange?: (appearance: DisplayAppearance) => void;
  onDesignStyleChange?: (style: DesignStyle) => void;
  onColorPaletteChange?: (palette: ColorPaletteName) => void;
}

export function ThemeEditor({
  theme,
  displayAppearance,
  designStyle,
  colorPalette,
  onChange,
  onDisplayAppearanceChange,
  onDesignStyleChange,
  onColorPaletteChange,
}: ThemeEditorProps) {
  const applyPalette = (paletteId: ColorPaletteName, paletteColors: Partial<ThemeColors>) => {
    onChange(generateDashboardColors(paletteColors));
    onColorPaletteChange?.(paletteId);
  };

  return (
    <div className="space-y-8">
      {/* 2-column grid: Palette left, Settings right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Color scheme cards */}
        <section className="lg:col-span-7">
          <PaletteSelector
            theme={theme}
            colorPalette={colorPalette}
            onApplyPalette={applyPalette}
          />
        </section>

        {/* Right: Darstellung + Token editor */}
        <section className="lg:col-span-5 space-y-5">
          <div>
            <h2 className="text-base font-bold text-stone-800 mb-1">Darstellung</h2>
            <p className="text-xs text-stone-500 uppercase tracking-widest mb-4">Display Configuration</p>
            <AppearanceSelector
              displayAppearance={displayAppearance}
              designStyle={designStyle}
              onDisplayAppearanceChange={onDisplayAppearanceChange}
              onDesignStyleChange={onDesignStyleChange}
            />
          </div>

          {/* Color token editor (collapsible) */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3">
              Einzelne Farbtokens
            </label>
            <ColorTokenEditor
              theme={theme}
              onChange={onChange}
            />
          </div>
        </section>
      </div>

</div>
  );
}
