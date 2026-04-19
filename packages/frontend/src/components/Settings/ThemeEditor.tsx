import { useMemo, useState } from 'react';
import type {
  ThemeColors,
  DesignStyle,
  ColorPaletteName,
  DisplayAppearance,
  HeaderSettings,
  MaintenanceScreenSettings,
  SaunaDetailStyle,
} from '@/types/settings.types';
import { generateDashboardColors, getDefaultSettings } from '@/types/settings.types';
import { normalizeMaintenanceScreenSettings } from '@/config/maintenanceScreen';
import { AppearanceSelector } from './AppearanceSelector';
import { PaletteSelector } from './PaletteSelector';
import { ColorTokenEditor } from './ColorTokenEditor';
import { SlideshowTokenOverridesEditor } from './SlideshowTokenOverridesEditor';
import { HeaderSettingsEditor } from './HeaderSettingsEditor';
import { MaintenanceScreenEditor } from './MaintenanceScreenEditor';
import { useSlideshows, useUpdateSlideshow } from '@/hooks/useSlideshows';
import type { SlideshowDefinition, SlideshowConfig } from '@/types/slideshow.types';
import type { DesignTokenOverrides } from '@htmlsignage/design-sdk';
import { Presentation } from 'lucide-react';

interface ThemeEditorProps {
  theme: ThemeColors;
  displayAppearance?: DisplayAppearance;
  designStyle?: DesignStyle;
  saunaDetailStyle?: SaunaDetailStyle;
  colorPalette?: ColorPaletteName;
  header?: HeaderSettings;
  maintenanceScreen?: MaintenanceScreenSettings;
  onChange: (theme: ThemeColors) => void;
  onDisplayAppearanceChange?: (appearance: DisplayAppearance) => void;
  onDesignStyleChange?: (style: DesignStyle) => void;
  onSaunaDetailStyleChange?: (style: SaunaDetailStyle) => void;
  onColorPaletteChange?: (palette: ColorPaletteName) => void;
  onHeaderChange?: (next: HeaderSettings) => void;
  onSlideshowContextChange?: (slideshowId: string | null) => void;
}

export function ThemeEditor({
  theme,
  displayAppearance,
  designStyle,
  saunaDetailStyle,
  colorPalette,
  header,
  maintenanceScreen,
  onChange,
  onDisplayAppearanceChange,
  onDesignStyleChange,
  onSaunaDetailStyleChange,
  onColorPaletteChange,
  onHeaderChange,
  onSlideshowContextChange,
}: ThemeEditorProps) {
  const defaults = getDefaultSettings();
  const globalHeader = header ?? defaults.header!;
  // The global maintenance-screen value may be partial, so normalise it
  // before merging with slideshow-level overrides. This mirrors how the
  // display runtime consumes the same value at render-time.
  const globalMaintenance = useMemo(
    () => normalizeMaintenanceScreenSettings(maintenanceScreen),
    [maintenanceScreen],
  );
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
  const effectiveSaunaDetailStyle =
    selectedSlideshow?.config.saunaDetailStyle ?? saunaDetailStyle;
  const effectivePalette = selectedSlideshow?.config.colorPalette ?? colorPalette;

  // Header: global value merged with any slideshow-level partial override
  // so the editor always shows what the display actually renders.
  const effectiveHeader: HeaderSettings = useMemo(
    () => ({
      ...globalHeader,
      ...(selectedSlideshow?.config.header ?? {}),
    }),
    [globalHeader, selectedSlideshow?.config.header],
  );

  // Same pattern for the maintenance screen: normalised global value is
  // the baseline, slideshow-level partial overrides win.
  const effectiveMaintenance: MaintenanceScreenSettings = useMemo(
    () => ({
      ...globalMaintenance,
      ...(selectedSlideshow?.config.maintenanceScreen ?? {}),
    }),
    [globalMaintenance, selectedSlideshow?.config.maintenanceScreen],
  );

  const handleHeaderChange = (next: HeaderSettings) => {
    if (selectedSlideshow) {
      // Persist only the fields that actually differ from the global
      // baseline — keeps slideshow overrides minimal and honest.
      const patch: Partial<HeaderSettings> = {};
      (Object.keys(next) as Array<keyof HeaderSettings>).forEach((key) => {
        if (next[key] !== globalHeader[key]) {
          (patch as Record<string, unknown>)[key] = next[key];
        }
      });
      handleSlideshowDesignChange({
        header: Object.keys(patch).length > 0 ? patch : undefined,
      });
    } else {
      onHeaderChange?.(next);
    }
  };

  const handleSlideshowDesignChange = (patch: Partial<SlideshowConfig>) => {
    if (!selectedSlideshow) return;
    const config: SlideshowConfig = { ...selectedSlideshow.config, ...patch };
    updateSlideshow.mutate({ id: selectedSlideshow.id, updates: { config } });
  };

  const handleMaintenanceScreenChange = (next: MaintenanceScreenSettings) => {
    if (selectedSlideshow) {
      // Only persist fields that actually differ from the normalised
      // global baseline — keeps overrides minimal and honest.
      const patch: Partial<MaintenanceScreenSettings> = {};
      (Object.keys(next) as Array<keyof MaintenanceScreenSettings>).forEach((key) => {
        if (next[key] !== globalMaintenance[key]) {
          (patch as Record<string, unknown>)[key] = next[key];
        }
      });
      handleSlideshowDesignChange({
        maintenanceScreen: Object.keys(patch).length > 0 ? patch : undefined,
      });
    } else {
      // Global edits are still done via the dedicated Maintenance tab in
      // SettingsPage, so we don't wire a global callback here. When no
      // slideshow is selected the editor isn't shown in the first place.
    }
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

  const handleSaunaDetailStyleChange = (v: SaunaDetailStyle) => {
    if (selectedSlideshow) {
      handleSlideshowDesignChange({ saunaDetailStyle: v });
    } else {
      onSaunaDetailStyleChange?.(v);
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
          {(selectedSlideshow.config.displayAppearance || selectedSlideshow.config.designStyle || selectedSlideshow.config.saunaDetailStyle || selectedSlideshow.config.colorPalette || selectedSlideshow.config.tokenOverrides || selectedSlideshow.config.header || selectedSlideshow.config.maintenanceScreen) && (
            <button
              onClick={() => handleSlideshowDesignChange({
                displayAppearance: undefined,
                designStyle: undefined,
                saunaDetailStyle: undefined,
                colorPalette: undefined,
                theme: undefined,
                tokenOverrides: undefined,
                header: undefined,
                maintenanceScreen: undefined,
              })}
              className="shrink-0 ml-3 text-xs font-semibold text-spa-info-dark hover:underline"
            >
              Alle Overrides entfernen
            </button>
          )}
        </div>
      )}

      {/* Branding header editor — shown first because the header sits
          at the top of every display and operators expect to edit it
          in that reading order. */}
      <HeaderSettingsEditor
        value={effectiveHeader}
        onChange={handleHeaderChange}
        scopeLabel={selectedSlideshow ? selectedSlideshow.name : 'Global'}
      />

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
              saunaDetailStyle={effectiveSaunaDetailStyle}
              onDisplayAppearanceChange={handleAppearanceChange}
              onDesignStyleChange={handleDesignStyleChange}
              onSaunaDetailStyleChange={handleSaunaDetailStyleChange}
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

          {/* Per-slideshow design-pack token overrides */}
          {selectedSlideshow && (
            <SlideshowTokenOverridesEditor
              value={selectedSlideshow.config.tokenOverrides}
              onChange={(next: DesignTokenOverrides | undefined) =>
                handleSlideshowDesignChange({ tokenOverrides: next })
              }
            />
          )}
        </section>
      </div>

      {/* Per-slideshow maintenance-screen override — only shown when a
          slideshow is selected. Global edits remain on the dedicated
          Maintenance tab in Settings. */}
      {selectedSlideshow && (
        <div className="rounded-xl border border-spa-border bg-spa-surface p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-spa-text-primary">
                Wartungsscreen-Override
              </h4>
              <p className="mt-0.5 text-xs text-spa-text-secondary">
                Nur abweichende Felder werden gespeichert. Leer gelassene
                Felder erben die globale Einstellung.
              </p>
            </div>
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-spa-text-secondary">
              {selectedSlideshow.name}
            </span>
          </div>
          <MaintenanceScreenEditor
            value={effectiveMaintenance}
            onChange={handleMaintenanceScreenChange}
          />
        </div>
      )}
    </div>
  );
}
