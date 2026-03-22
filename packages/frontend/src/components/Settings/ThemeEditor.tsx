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
    <div className="space-y-6">
      <AppearanceSelector
        displayAppearance={displayAppearance}
        designStyle={designStyle}
        onDisplayAppearanceChange={onDisplayAppearanceChange}
        onDesignStyleChange={onDesignStyleChange}
      />

      <PaletteSelector
        theme={theme}
        colorPalette={colorPalette}
        onApplyPalette={applyPalette}
      />

      <ColorTokenEditor
        theme={theme}
        onChange={onChange}
      />

      {/* Preview */}
      <div>
        <h3 className="text-lg font-semibold text-spa-text-primary mb-3">Vorschau</h3>
        <div
          className="p-6 rounded-lg border-2 transition-all"
          style={{
            backgroundColor: theme.bg,
            color: theme.fg,
            borderColor: theme.accent,
          }}
        >
          <div className="mb-4">
            <h4 className="text-xl font-bold mb-2" style={{ color: theme.fg }}>
              Beispiel-Überschrift
            </h4>
            <p style={{ color: theme.fg }}>
              Dies ist ein Beispieltext in der ausgewählten Farbpalette.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded" style={{ backgroundColor: theme.cellBg }}>
              <div className="text-sm font-medium" style={{ color: theme.boxFg }}>
                Zellen-Hintergrund
              </div>
            </div>
            <div className="p-3 rounded" style={{ backgroundColor: theme.accent, color: '#fff' }}>
              <div className="text-sm font-medium">Akzent-Farbe</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
