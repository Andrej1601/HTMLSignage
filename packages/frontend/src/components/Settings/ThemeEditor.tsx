import { useMemo, useState } from 'react';
import type {
  ThemeColors,
  DesignStyle,
  ColorPaletteName,
  DisplayAppearance,
  DisplaySettings,
  MaintenanceScreenSettings,
  SaunaDetailStyle,
} from '@/types/settings.types';
import { generateDashboardColors } from '@/types/settings.types';
import { AppearanceSelector } from './AppearanceSelector';
import { PaletteSelector } from './PaletteSelector';
import { ColorTokenEditor } from './ColorTokenEditor';
import { SlideshowTokenOverridesEditor } from './SlideshowTokenOverridesEditor';
import { DEFAULT_DESIGN_ID, isKnownDesignId, type DesignId } from '@/designs';
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
  maintenanceScreen?: MaintenanceScreenSettings;
  /**
   * Full `display` settings block — used by the embedded
   * `DesignPackFlagCard` to toggle the pack-rendering pipeline and
   * pick the active pack. Must be passed when the consumer wants the
   * design-pack card to appear.
   */
  display?: DisplaySettings;
  onChange: (theme: ThemeColors) => void;
  onDisplayAppearanceChange?: (appearance: DisplayAppearance) => void;
  onDesignStyleChange?: (style: DesignStyle) => void;
  onSaunaDetailStyleChange?: (style: SaunaDetailStyle) => void;
  onColorPaletteChange?: (palette: ColorPaletteName) => void;
  /**
   * Emits the next `display` block when the design-pack card is edited.
   * Optional: when omitted the pack card is read-only (still rendered
   * but inert).
   */
  onDisplayChange?: (next: DisplaySettings) => void;
  onSlideshowContextChange?: (slideshowId: string | null) => void;
}

export function ThemeEditor({
  theme,
  // displayAppearance kept on the props interface for API compat with
  // older parents; the new editor ignores it (Bühne-Konzept entfernt).
  displayAppearance: _displayAppearance,
  designStyle,
  saunaDetailStyle,
  colorPalette,
  // Maintenance-screen now lives only on the dedicated "Wartungsscreen"
  // tab. Prop kept on the interface for API compat.
  maintenanceScreen: _maintenanceScreen,
  display,
  onChange,
  // Bühnen-Chrome wird nicht mehr durch die UI gewechselt; der Prop
  // bleibt für API-Kompatibilität bestehen, wird aber ignoriert.
  onDisplayAppearanceChange: _onDisplayAppearanceChange,
  onDesignStyleChange,
  onSaunaDetailStyleChange,
  onColorPaletteChange,
  onDisplayChange,
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
  const effectiveDesignStyle = selectedSlideshow?.config.designStyle ?? designStyle;
  const effectiveSaunaDetailStyle =
    selectedSlideshow?.config.saunaDetailStyle ?? saunaDetailStyle;
  const effectivePalette = selectedSlideshow?.config.colorPalette ?? colorPalette;

  const handleSlideshowDesignChange = (patch: Partial<SlideshowConfig>) => {
    if (!selectedSlideshow) return;
    const config: SlideshowConfig = { ...selectedSlideshow.config, ...patch };
    updateSlideshow.mutate({ id: selectedSlideshow.id, updates: { config } });
  };

  const applyPalette = (paletteId: ColorPaletteName, paletteColors: Partial<ThemeColors>) => {
    if (selectedSlideshow) {
      // Also persist the resolved theme tokens on the slideshow so the
      // renderer's `mergeTokenOverrides(globalTheme, slideshowTheme,
      // tokenOverrides)` picks up the per-slideshow palette without
      // needing an additional global save.
      handleSlideshowDesignChange({
        colorPalette: paletteId,
        theme: generateDashboardColors(paletteColors),
      });
    } else {
      onChange(generateDashboardColors(paletteColors));
      onColorPaletteChange?.(paletteId);
    }
  };

  // Per-slideshow color-token edits flow into `slideshow.config.theme`,
  // global edits into the parent-supplied `onChange`.
  const handleThemeChange = (next: ThemeColors) => {
    if (selectedSlideshow) {
      handleSlideshowDesignChange({ theme: next });
    } else {
      onChange(next);
    }
  };

  // Effective theme used by the right-side ColorTokenEditor: the
  // selected slideshow's overrides win, otherwise the global theme.
  const effectiveTheme: ThemeColors = useMemo(
    () => ({ ...theme, ...(selectedSlideshow?.config.theme ?? {}) }),
    [theme, selectedSlideshow?.config.theme],
  );

  // Pack-Wechsel: setzt das aktive Design-Pack. Per-Slideshow-Override
  // landet auf `slideshow.config.designPackId`, globaler Wechsel auf
  // `display.designPackId`. Der Renderer bevorzugt zur Render-Zeit den
  // Slideshow-Wert vor dem globalen.
  const handleDesignPackChange = (id: DesignId) => {
    if (selectedSlideshow) {
      handleSlideshowDesignChange({ designPackId: id });
      return;
    }
    if (display && onDisplayChange) {
      onDisplayChange({ ...display, designPackId: id });
    }
  };

  const handleAccentStripesChange = (next: boolean) => {
    if (display && onDisplayChange) {
      onDisplayChange({ ...display, accentStripes: next });
    }
  };

  const handleHeroOverlayIntensityChange = (next: number) => {
    if (display && onDisplayChange) {
      onDisplayChange({ ...display, heroOverlayIntensity: next });
    }
  };

  // Effective pack id für die Selektion: Wenn ein Slideshow-Scope aktiv
  // ist, gewinnt deren `config.designPackId` über den globalen Default —
  // sonst zeigt der AppearanceSelector den globalen Pack als aktiv, der
  // User klickt einen Slideshow-Pack, sieht aber visuell keine Änderung
  // (obwohl der Pack korrekt gespeichert und der Display tatsächlich
  // umschaltet). Reihenfolge: Slideshow > Global > Default.
  const slideshowConfiguredPackId = selectedSlideshow?.config.designPackId;
  const globalConfiguredPackId = display?.designPackId;
  const configuredPackId = isKnownDesignId(slideshowConfiguredPackId)
    ? slideshowConfiguredPackId
    : globalConfiguredPackId;
  const activeDesignPackId: DesignId = isKnownDesignId(configuredPackId)
    ? configuredPackId
    : DEFAULT_DESIGN_ID;

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
          {(selectedSlideshow.config.displayAppearance || selectedSlideshow.config.designStyle || selectedSlideshow.config.saunaDetailStyle || selectedSlideshow.config.colorPalette || selectedSlideshow.config.theme || selectedSlideshow.config.tokenOverrides || selectedSlideshow.config.designPackId || selectedSlideshow.config.header) && (
            <button
              type="button"
              onClick={() => handleSlideshowDesignChange({
                displayAppearance: undefined,
                designStyle: undefined,
                saunaDetailStyle: undefined,
                colorPalette: undefined,
                theme: undefined,
                tokenOverrides: undefined,
                designPackId: undefined,
                header: undefined,
              })}
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
              designPackId={activeDesignPackId}
              designStyle={effectiveDesignStyle}
              saunaDetailStyle={effectiveSaunaDetailStyle}
              accentStripes={display?.accentStripes === true}
              onDesignPackChange={handleDesignPackChange}
              onDesignStyleChange={handleDesignStyleChange}
              onSaunaDetailStyleChange={handleSaunaDetailStyleChange}
              onAccentStripesChange={
                !selectedSlideshow && display && onDisplayChange
                  ? handleAccentStripesChange
                  : undefined
              }
            />
          </div>

          {/* Color token editor — both global and per-slideshow now. */}
          <div className="bg-spa-surface rounded-xl border border-spa-border p-4 shadow-xs">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-text-secondary mb-3">
              Einzelne Farbtokens
              {selectedSlideshow && (
                <span className="ml-2 normal-case tracking-normal text-spa-text-secondary/80">
                  · überschreibt {selectedSlideshow.name}
                </span>
              )}
            </label>
            <ColorTokenEditor
              theme={effectiveTheme}
              onChange={handleThemeChange}
              heroOverlayIntensity={display?.heroOverlayIntensity ?? 1}
              onHeroOverlayIntensityChange={
                !selectedSlideshow && display && onDisplayChange
                  ? handleHeroOverlayIntensityChange
                  : undefined
              }
            />
          </div>

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
    </div>
  );
}
