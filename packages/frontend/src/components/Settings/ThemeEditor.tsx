import { useMemo, useState } from 'react';
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
import { useSlideshows, useUpdateSlideshow } from '@/hooks/useSlideshows';
import type { SlideshowDefinition, SlideshowConfig } from '@/types/slideshow.types';
import { Presentation } from 'lucide-react';

interface ThemeEditorProps {
  theme: ThemeColors;
  displayAppearance?: DisplayAppearance;
  designStyle?: DesignStyle;
  colorPalette?: ColorPaletteName;
  onChange: (theme: ThemeColors) => void;
  onDisplayAppearanceChange?: (appearance: DisplayAppearance) => void;
  onDesignStyleChange?: (style: DesignStyle) => void;
  onColorPaletteChange?: (palette: ColorPaletteName) => void;
  onSlideshowContextChange?: (slideshowId: string | null) => void;
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
  onSlideshowContextChange,
}: ThemeEditorProps) {
  const { data: slideshows = [] } = useSlideshows();
  const updateSlideshow = useUpdateSlideshow();
  const [selectedSlideshowId, setSelectedSlideshowId] = useState<string | null>(null);

  const handleSlideshowSelect = (id: string | null) => {
    setSelectedSlideshowId(id);
    onSlideshowContextChange?.(id);
  };

  const selectedSlideshow = useMemo(
    () => slideshows.find((s: SlideshowDefinition) => s.id === selectedSlideshowId) || null,
    [slideshows, selectedSlideshowId],
  );

  // When editing a slideshow, read its design overrides
  const effectiveAppearance = selectedSlideshow?.config.displayAppearance ?? displayAppearance;
  const effectiveDesignStyle = selectedSlideshow?.config.designStyle ?? designStyle;
  const effectivePalette = selectedSlideshow?.config.colorPalette ?? colorPalette;

  const handleSlideshowDesignChange = (patch: Partial<SlideshowConfig>) => {
    if (!selectedSlideshow) return;
    const config: SlideshowConfig = { ...selectedSlideshow.config, ...patch };
    updateSlideshow.mutate({ id: selectedSlideshow.id, updates: { config } });
  };

  const applyPalette = (paletteId: ColorPaletteName, paletteColors: Partial<ThemeColors>) => {
    if (selectedSlideshow) {
      handleSlideshowDesignChange({ colorPalette: paletteId });
    } else {
      onChange(generateDashboardColors(paletteColors));
      onColorPaletteChange?.(paletteId);
    }
  };

  const handleAppearanceChange = (v: DisplayAppearance) => {
    if (selectedSlideshow) {
      handleSlideshowDesignChange({ displayAppearance: v });
    } else {
      onDisplayAppearanceChange?.(v);
    }
  };

  const handleDesignStyleChange = (v: DesignStyle) => {
    if (selectedSlideshow) {
      handleSlideshowDesignChange({ designStyle: v });
    } else {
      onDesignStyleChange?.(v);
    }
  };

  return (
    <div className="space-y-6">
      {/* Slideshow-Auswahl */}
      {slideshows.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-spa-bg-secondary border border-spa-border">
          <Presentation className="w-5 h-5 text-spa-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <label className="text-sm font-semibold text-spa-text-primary">Design anpassen für</label>
            <p className="text-xs text-spa-text-secondary">Global oder pro Slideshow</p>
          </div>
          <select
            value={selectedSlideshowId || ''}
            onChange={(e) => handleSlideshowSelect(e.target.value || null)}
            className="min-w-[200px] px-3 py-2 border border-spa-border rounded-lg text-sm bg-spa-surface text-spa-text-primary focus:ring-2 focus:ring-spa-primary/20 focus:border-spa-primary outline-hidden"
          >
            <option value="">Globale Einstellungen</option>
            {slideshows.map((show: SlideshowDefinition) => (
              <option key={show.id} value={show.id}>
                {show.name} {show.isDefault ? '(Standard)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Info wenn Slideshow gewählt */}
      {selectedSlideshow && (
        <div className="p-3 rounded-lg bg-spa-info-light border border-spa-info/20 text-spa-info-dark text-xs leading-relaxed flex items-center justify-between">
          <span>
            Änderungen gelten nur für <strong>{selectedSlideshow.name}</strong>.
            Nicht gesetzte Werte fallen auf die globalen Einstellungen zurück.
          </span>
          {(selectedSlideshow.config.displayAppearance || selectedSlideshow.config.designStyle || selectedSlideshow.config.colorPalette) && (
            <button
              onClick={() => handleSlideshowDesignChange({ displayAppearance: undefined, designStyle: undefined, colorPalette: undefined, theme: undefined })}
              className="shrink-0 ml-3 text-xs font-semibold text-spa-info-dark hover:underline"
            >
              Alle Overrides entfernen
            </button>
          )}
        </div>
      )}

      {/* 2-column grid: Palette left, Settings right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Color scheme cards */}
        <section className="lg:col-span-7">
          <PaletteSelector
            theme={theme}
            colorPalette={effectivePalette}
            onApplyPalette={applyPalette}
          />
        </section>

        {/* Right: Darstellung + Token editor */}
        <section className="lg:col-span-5 space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-spa-text-primary mb-1">Darstellung</h3>
            <p className="text-sm text-spa-text-secondary mb-4">Display-Erscheinungsbild und Design-Stil</p>
            <AppearanceSelector
              displayAppearance={effectiveAppearance}
              designStyle={effectiveDesignStyle}
              onDisplayAppearanceChange={handleAppearanceChange}
              onDesignStyleChange={handleDesignStyleChange}
            />
          </div>

          {/* Color token editor (only for global) */}
          {!selectedSlideshow && (
            <div className="bg-spa-surface rounded-xl border border-spa-border p-4 shadow-xs">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-text-secondary mb-3">
                Einzelne Farbtokens
              </label>
              <ColorTokenEditor
                theme={theme}
                onChange={onChange}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
