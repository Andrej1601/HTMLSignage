import { useState, useEffect, useCallback } from 'react';
import type {
  ThemeColors,
  DesignStyle,
  ColorPaletteName,
  DisplayAppearance,
} from '@/types/settings.types';
import { COLOR_PALETTES, generateDashboardColors } from '@/types/settings.types';
import {
  DISPLAY_APPEARANCE_OPTIONS,
  SCHEDULE_DESIGN_STYLE_OPTIONS,
} from '@/config/displayDesignStyles';
import { palettesApi, type CustomPalette } from '@/services/api';
import { Palette, ChevronDown, ChevronUp, Plus, Trash2, Save, X } from 'lucide-react';

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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customPalettes, setCustomPalettes] = useState<CustomPalette[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState('');
  const [savingPalette, setSavingPalette] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCustomPalettes = useCallback(async () => {
    try {
      const palettes = await palettesApi.getAll();
      setCustomPalettes(palettes);
    } catch (err) {
      console.error('[ThemeEditor] Failed to load custom palettes:', err);
    }
  }, []);

  useEffect(() => {
    loadCustomPalettes();
  }, [loadCustomPalettes]);

  const applyPalette = (paletteId: ColorPaletteName, paletteColors: Partial<ThemeColors>) => {
    onChange(generateDashboardColors(paletteColors));
    if (onColorPaletteChange) {
      onColorPaletteChange(paletteId);
    }
  };

  const updateColor = (key: keyof ThemeColors, value: string) => {
    onChange({ ...theme, [key]: value });
  };

  const handleCreatePalette = async () => {
    if (!newPaletteName.trim()) return;
    setSavingPalette(true);
    try {
      await palettesApi.create(newPaletteName.trim(), theme);
      setNewPaletteName('');
      setShowCreateDialog(false);
      await loadCustomPalettes();
    } catch (err) {
      console.error('[ThemeEditor] Failed to create palette:', err);
    } finally {
      setSavingPalette(false);
    }
  };

  const handleUpdatePalette = async (palette: CustomPalette) => {
    try {
      await palettesApi.update(palette.id, palette.name, theme);
      await loadCustomPalettes();
    } catch (err) {
      console.error('[ThemeEditor] Failed to update palette:', err);
    }
  };

  const handleDeletePalette = async (id: string) => {
    setDeletingId(id);
    try {
      await palettesApi.delete(id);
      if (colorPalette === id) {
        // Reset to first built-in palette
        applyPalette(COLOR_PALETTES[0].id, COLOR_PALETTES[0].colors);
      }
      await loadCustomPalettes();
    } catch (err) {
      console.error('[ThemeEditor] Failed to delete palette:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const colorGroups = [
    {
      title: 'Basis & Fallback',
      colors: [
        { key: 'bg' as keyof ThemeColors, label: 'Basis-Hintergrund', description: 'Grundfläche für einfache Slides und Fallbacks' },
        { key: 'fg' as keyof ThemeColors, label: 'Basis-Text', description: 'Standard-Textfarbe für einfache Slides und Fallbacks' },
        { key: 'accent' as keyof ThemeColors, label: 'Primärakzent', description: 'Hauptakzent für Marker, Linien und Hervorhebungen' },
      ],
    },
    {
      title: 'Linien & Flächen',
      colors: [
        { key: 'gridTable' as keyof ThemeColors, label: 'Linien & Trenner', description: 'Trenner, Rasterlinien und Fallback-Rahmen' },
        { key: 'cellBg' as keyof ThemeColors, label: 'Innenflächen', description: 'Innenflächen von Karten, Zellen und Detailboxen' },
        { key: 'timeColBg' as keyof ThemeColors, label: 'Sekundärakzent', description: 'Sekundärer Akzent; früher Zeitspalte, heute auch Highlight-Fallback' },
      ],
    },
    {
      title: 'Wechselflächen',
      colors: [
        { key: 'zebra1' as keyof ThemeColors, label: 'Fläche A', description: 'Erste alternierende Fläche, z. B. linke oder gerade Bereiche' },
        { key: 'zebra2' as keyof ThemeColors, label: 'Fläche B', description: 'Zweite alternierende Fläche, z. B. rechte oder ungerade Bereiche' },
        { key: 'timeZebra1' as keyof ThemeColors, label: 'Reserve A', description: 'Reservierter Altwert aus älteren Zeitspalten-Layouts' },
        { key: 'timeZebra2' as keyof ThemeColors, label: 'Reserve B', description: 'Reservierter Altwert aus älteren Zeitspalten-Layouts' },
      ],
    },
    {
      title: 'Plan-Header (klassisch)',
      colors: [
        { key: 'headRowBg' as keyof ThemeColors, label: 'Header-Hintergrund', description: 'Kopfzeile im klassischen Plan-/Tabellenlayout' },
        { key: 'headRowFg' as keyof ThemeColors, label: 'Header-Text', description: 'Textfarbe im klassischen Plan-/Tabellenlayout' },
        { key: 'cornerBg' as keyof ThemeColors, label: 'Plan-Ecke Hintergrund', description: 'Reservierter Altwert für Tabellenecken' },
        { key: 'cornerFg' as keyof ThemeColors, label: 'Plan-Ecke Text', description: 'Reservierter Altwert für Tabellenecken' },
      ],
    },
    {
      title: 'Spezial & Legacy',
      colors: [
        { key: 'flame' as keyof ThemeColors, label: 'Flammen-Symbol', description: 'Aufguss-/Hitze-Symbol und Badge-Akzent' },
        { key: 'boxFg' as keyof ThemeColors, label: 'Tabellen-/Box-Text', description: 'Text in klassischen Planboxen und Legacy-Komponenten' },
      ],
    },
    {
      title: 'Display-Oberfläche',
      colors: [
        { key: 'dashboardBg' as keyof ThemeColors, label: 'Display-Grundfläche', description: 'Hintergrund der modernen Display-Ansicht' },
        { key: 'cardBg' as keyof ThemeColors, label: 'Kartenfläche', description: 'Hintergrund von Karten, Panels und Modulen' },
        { key: 'cardBorder' as keyof ThemeColors, label: 'Karten-Trenner', description: 'Rahmen und Linien zwischen Karten und Modulen' },
        { key: 'textMain' as keyof ThemeColors, label: 'Primärtext', description: 'Haupttext in modernen Display-Layouts' },
        { key: 'textMuted' as keyof ThemeColors, label: 'Sekundärtext', description: 'Dezentere Texte, Metadaten und Nebentexte' },
        { key: 'accentGold' as keyof ThemeColors, label: 'Akzent warm', description: 'Warmer Hauptakzent für Titel, Logos und Highlights' },
        { key: 'accentGreen' as keyof ThemeColors, label: 'Akzent kühl', description: 'Kühler Zweitakzent für Panels, Listen und Highlights' },
        { key: 'statusLive' as keyof ThemeColors, label: 'Status: Läuft', description: 'Aktiver Live-/Läuft-Indikator' },
        { key: 'statusNext' as keyof ThemeColors, label: 'Status: Nächster', description: 'Badge für den nächsten Slot' },
        { key: 'statusPrestart' as keyof ThemeColors, label: 'Status: Gleich', description: 'Badge für bald startende Slots' },
      ],
    },
  ];

  const renderPaletteCard = (
    id: string,
    name: string,
    colors: Partial<ThemeColors>,
    options?: { isCustom?: boolean; customPalette?: CustomPalette }
  ) => {
    const isActive = colorPalette === id;
    const previewTheme = generateDashboardColors(colors);
    const swatches = [
      { label: 'BG', color: previewTheme.dashboardBg || previewTheme.bg || '#000000' },
      { label: 'Card', color: previewTheme.cardBg || previewTheme.cellBg || '#000000' },
      { label: 'Text', color: previewTheme.textMain || previewTheme.fg || '#000000' },
      { label: 'A1', color: previewTheme.accentGold || previewTheme.accent || '#000000' },
      { label: 'A2', color: previewTheme.accentGreen || previewTheme.timeColBg || '#000000' },
      { label: 'Live', color: previewTheme.statusLive || '#10B981' },
    ];

    return (
      <div
        key={id}
        className={`relative p-4 border-2 rounded-lg transition-all text-left group ${
          isActive
            ? 'border-spa-accent bg-spa-accent/5 shadow-md'
            : 'border-spa-secondary/20 hover:border-spa-accent hover:shadow-md'
        }`}
      >
        <button
          onClick={() => applyPalette(id, colors)}
          className="w-full text-left"
        >
          <div className="flex items-center justify-between mb-2">
            <div className={`font-medium ${isActive ? 'text-spa-accent' : 'text-spa-text-primary group-hover:text-spa-accent'} transition-colors`}>
              {name}
            </div>
            {isActive && (
              <div className="w-2 h-2 rounded-full bg-spa-accent"></div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {swatches.map((swatch) => (
              <div key={swatch.label} className="flex flex-col items-center gap-1">
                <div
                  className="w-8 h-8 rounded border border-black/10"
                  style={{ backgroundColor: swatch.color }}
                  title={`${swatch.label}: ${swatch.color}`}
                />
                <span className="text-[10px] text-spa-text-secondary leading-none">{swatch.label}</span>
              </div>
            ))}
          </div>
        </button>

        {/* Custom palette actions */}
        {options?.isCustom && options.customPalette && (
          <div className="flex gap-1 mt-2 pt-2 border-t border-spa-secondary/20">
            <button
              onClick={(e) => { e.stopPropagation(); handleUpdatePalette(options.customPalette!); }}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs rounded bg-spa-accent/10 text-spa-accent hover:bg-spa-accent/20 transition-colors"
              title="Aktuelle Farben in diese Palette speichern"
            >
              <Save className="w-3 h-3" />
              Aktualisieren
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDeletePalette(options.customPalette!.id); }}
              disabled={deletingId === options.customPalette!.id}
              className="flex items-center justify-center gap-1 px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
              title="Palette loeschen"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Display Appearance */}
      <div>
        <h3 className="text-lg font-semibold text-spa-text-primary mb-3">Visuelle Aufmachung</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DISPLAY_APPEARANCE_OPTIONS.map((appearance) => (
            <button
              key={appearance.id}
              onClick={() => onDisplayAppearanceChange?.(appearance.id)}
              disabled={!onDisplayAppearanceChange}
              className={`p-4 border-2 rounded-lg transition-all text-left ${
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
      </div>

      {/* Schedule Style */}
      <div>
        <h3 className="text-lg font-semibold text-spa-text-primary mb-3">Plan-Darstellung</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SCHEDULE_DESIGN_STYLE_OPTIONS.map((style) => (
            <button
              key={style.id}
              onClick={() => onDesignStyleChange?.(style.id)}
              disabled={!onDesignStyleChange}
              className={`p-4 border-2 rounded-lg transition-all text-left ${
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
      </div>

      {/* Color Palettes */}
      <div>
        <h3 className="text-lg font-semibold text-spa-text-primary mb-3 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Farbpaletten
        </h3>
        <p className="text-sm text-spa-text-secondary mb-4">
          Waehlen Sie eine Farbpalette. Diese Farben steuern direkt die Slideshow-Darstellung.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {COLOR_PALETTES.map((palette) =>
            renderPaletteCard(palette.id, palette.name, palette.colors)
          )}
        </div>
      </div>

      {/* Custom Palettes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-spa-text-primary flex items-center gap-2">
            Eigene Paletten
          </h3>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-spa-accent text-white hover:bg-spa-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neue Palette
          </button>
        </div>

        {/* Create dialog */}
        {showCreateDialog && (
          <div className="mb-4 p-4 bg-spa-bg-secondary rounded-lg border border-spa-secondary/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-spa-text-primary">Aktuelle Farben als neue Palette speichern:</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPaletteName}
                onChange={(e) => setNewPaletteName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePalette()}
                placeholder="Name der Palette..."
                className="flex-1 px-3 py-2 text-sm border rounded-lg border-spa-secondary/30 bg-white text-spa-text-primary focus:outline-none focus:ring-2 focus:ring-spa-accent/50"
                autoFocus
              />
              <button
                onClick={handleCreatePalette}
                disabled={!newPaletteName.trim() || savingPalette}
                className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-spa-accent text-white hover:bg-spa-accent/90 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Speichern
              </button>
              <button
                onClick={() => { setShowCreateDialog(false); setNewPaletteName(''); }}
                className="flex items-center px-2 py-2 text-sm rounded-lg text-spa-text-secondary hover:text-spa-text-primary hover:bg-spa-secondary/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-spa-text-secondary mt-2">
              Die aktuell eingestellten Farben werden als neue Palette gespeichert.
            </p>
          </div>
        )}

        {customPalettes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {customPalettes.map((cp) =>
              renderPaletteCard(cp.id, cp.name, cp.colors as Partial<ThemeColors>, {
                isCustom: true,
                customPalette: cp,
              })
            )}
          </div>
        ) : !showCreateDialog ? (
          <p className="text-sm text-spa-text-secondary italic">
            Noch keine eigenen Paletten erstellt. Passen Sie die Farben an und klicken Sie "Neue Palette" um sie zu speichern.
          </p>
        ) : null}
      </div>

      {/* Advanced Color Editor */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-spa-text-primary hover:text-spa-accent transition-colors font-medium mb-4"
        >
          {showAdvanced ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          Erweiterte Farb-Einstellungen
        </button>

        {showAdvanced && (
          <div className="space-y-6 p-4 bg-spa-bg-secondary rounded-lg">
            <div className="rounded-lg border border-spa-secondary/20 bg-white/80 px-4 py-3 text-sm text-spa-text-secondary">
              Einige Farbschlüssel stammen aus älteren Layouts. Die Namen unten beschreiben deshalb die heutige tatsächliche Wirkung im Display, nicht zwingend den historischen internen Feldnamen.
            </div>
            {colorGroups.map((group, groupIndex) => (
              <div key={groupIndex}>
                <h4 className="font-semibold text-spa-text-primary mb-3">{group.title}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.colors.map(({ key, label, description }) => (
                    <div key={key} className="flex items-center gap-3">
                      <input
                        type="color"
                        value={theme[key] || '#000000'}
                        onChange={(e) => updateColor(key, e.target.value)}
                        className="w-12 h-12 rounded cursor-pointer border-2 border-spa-secondary/30"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm text-spa-text-primary">{label}</div>
                        <div className="text-xs text-spa-text-secondary">{description}</div>
                      </div>
                      <div className="text-xs font-mono text-spa-text-secondary">
                        {theme[key]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
              Beispiel-Ueberschrift
            </h4>
            <p style={{ color: theme.fg }}>
              Dies ist ein Beispieltext in der ausgewaehlten Farbpalette.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div
              className="p-3 rounded"
              style={{ backgroundColor: theme.cellBg }}
            >
              <div className="text-sm font-medium" style={{ color: theme.boxFg }}>
                Zellen-Hintergrund
              </div>
            </div>
            <div
              className="p-3 rounded"
              style={{ backgroundColor: theme.accent, color: '#fff' }}
            >
              <div className="text-sm font-medium">
                Akzent-Farbe
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
