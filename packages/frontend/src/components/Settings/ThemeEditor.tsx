import { useState } from 'react';
import type { ThemeColors, DesignStyle, ColorPaletteName } from '@/types/settings.types';
import { COLOR_PALETTES, generateDashboardColors } from '@/types/settings.types';
import { Palette, ChevronDown, ChevronUp } from 'lucide-react';

interface ThemeEditorProps {
  theme: ThemeColors;
  designStyle?: DesignStyle;
  colorPalette?: ColorPaletteName;
  onChange: (theme: ThemeColors) => void;
  onDesignStyleChange?: (style: DesignStyle) => void;
  onColorPaletteChange?: (palette: ColorPaletteName) => void;
}

export function ThemeEditor({
  theme,
  designStyle,
  colorPalette,
  onChange,
  onDesignStyleChange,
  onColorPaletteChange,
}: ThemeEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const applyPalette = (paletteId: ColorPaletteName, paletteColors: Partial<ThemeColors>) => {
    // Palette selection should fully drive the theme (including derived dashboard tokens),
    // otherwise old palette leftovers can "leak" into the modern wellness design.
    onChange(generateDashboardColors(paletteColors));
    if (onColorPaletteChange) {
      onColorPaletteChange(paletteId);
    }
  };

  const updateColor = (key: keyof ThemeColors, value: string) => {
    onChange({ ...theme, [key]: value });
  };

  const colorGroups = [
    {
      title: 'Haupt-Farben',
      colors: [
        { key: 'bg' as keyof ThemeColors, label: 'Hintergrund', description: 'Haupt-Hintergrundfarbe' },
        { key: 'fg' as keyof ThemeColors, label: 'Vordergrund', description: 'Haupt-Textfarbe' },
        { key: 'accent' as keyof ThemeColors, label: 'Akzent', description: 'Akzent-/Highlight-Farbe' },
      ],
    },
    {
      title: 'Grid/Tabelle',
      colors: [
        { key: 'gridTable' as keyof ThemeColors, label: 'Grid-Linien', description: 'Farbe der Grid-Linien' },
        { key: 'cellBg' as keyof ThemeColors, label: 'Zellen-BG', description: 'Hintergrund der Zellen' },
        { key: 'timeColBg' as keyof ThemeColors, label: 'Zeit-Spalte', description: 'Zeit-Spalten-Hintergrund' },
      ],
    },
    {
      title: 'Zebra-Streifen',
      colors: [
        { key: 'zebra1' as keyof ThemeColors, label: 'Zebra 1', description: 'Erste Zebra-Farbe' },
        { key: 'zebra2' as keyof ThemeColors, label: 'Zebra 2', description: 'Zweite Zebra-Farbe' },
        { key: 'timeZebra1' as keyof ThemeColors, label: 'Zeit Zebra 1', description: 'Zeit-Spalte Zebra 1' },
        { key: 'timeZebra2' as keyof ThemeColors, label: 'Zeit Zebra 2', description: 'Zeit-Spalte Zebra 2' },
      ],
    },
    {
      title: 'Kopfzeile',
      colors: [
        { key: 'headRowBg' as keyof ThemeColors, label: 'Kopf-BG', description: 'Kopfzeilen-Hintergrund' },
        { key: 'headRowFg' as keyof ThemeColors, label: 'Kopf-Text', description: 'Kopfzeilen-Textfarbe' },
        { key: 'cornerBg' as keyof ThemeColors, label: 'Ecke-BG', description: 'Ecken-Hintergrund' },
        { key: 'cornerFg' as keyof ThemeColors, label: 'Ecke-Text', description: 'Ecken-Textfarbe' },
      ],
    },
    {
      title: 'Spezial',
      colors: [
        { key: 'flame' as keyof ThemeColors, label: 'Flamme', description: 'Flammen-Icon-Farbe' },
        { key: 'boxFg' as keyof ThemeColors, label: 'Box-Text', description: 'Text in Boxen' },
      ],
    },
    {
      title: 'Slideshow (Modern)',
      colors: [
        { key: 'dashboardBg' as keyof ThemeColors, label: 'Panel-Hintergrund', description: 'Grundflaeche der Slideshow' },
        { key: 'cardBg' as keyof ThemeColors, label: 'Karten-BG', description: 'Hintergrund der Infokarten' },
        { key: 'cardBorder' as keyof ThemeColors, label: 'Karten-Rahmen', description: 'Rahmenfarbe der Karten' },
        { key: 'textMain' as keyof ThemeColors, label: 'Haupttext', description: 'Primaerer Slideshow-Text' },
        { key: 'textMuted' as keyof ThemeColors, label: 'Sekundaertext', description: 'Dezenter Zusatztext' },
        { key: 'accentGold' as keyof ThemeColors, label: 'Akzent 1', description: 'Headline-/Highlight-Akzent' },
        { key: 'accentGreen' as keyof ThemeColors, label: 'Akzent 2', description: 'Sekundaerer Akzent' },
        { key: 'statusLive' as keyof ThemeColors, label: 'Status Live', description: 'Aktiv-/Live-Indikator' },
        { key: 'statusNext' as keyof ThemeColors, label: 'Status Naechster', description: 'Naechster Slot/Status' },
        { key: 'statusPrestart' as keyof ThemeColors, label: 'Status Bald', description: 'Prestart-/Bald-Indikator' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Design Style */}
      <div>
        <h3 className="text-lg font-semibold text-spa-text-primary mb-3">Design-Stil</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              id: 'modern-wellness' as const,
              title: 'Modern Wellness',
              description: 'Klassisches Wellness-Grid (60/40) mit Saunakacheln.',
            },
            {
              id: 'modern-timeline' as const,
              title: 'Modern Timeline',
              description: 'Zeitachsen-Layout nach Design3 mit Timeline-Tabelle.',
            },
          ].map((style) => (
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
          {COLOR_PALETTES.map((palette) => {
            const isActive = colorPalette === palette.id;
            const previewTheme = generateDashboardColors(palette.colors);
            const swatches = [
              { label: 'BG', color: previewTheme.dashboardBg || previewTheme.bg || '#000000' },
              { label: 'Card', color: previewTheme.cardBg || previewTheme.cellBg || '#000000' },
              { label: 'Text', color: previewTheme.textMain || previewTheme.fg || '#000000' },
              { label: 'A1', color: previewTheme.accentGold || previewTheme.accent || '#000000' },
              { label: 'A2', color: previewTheme.accentGreen || previewTheme.timeColBg || '#000000' },
              { label: 'Live', color: previewTheme.statusLive || '#10B981' },
            ];
            return (
              <button
                key={palette.id}
                onClick={() => applyPalette(palette.id, palette.colors)}
                className={`p-4 border-2 rounded-lg transition-all text-left group ${
                  isActive
                    ? 'border-spa-accent bg-spa-accent/5 shadow-md'
                    : 'border-spa-secondary/20 hover:border-spa-accent hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`font-medium ${isActive ? 'text-spa-accent' : 'text-spa-text-primary group-hover:text-spa-accent'} transition-colors`}>
                    {palette.name}
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
            );
          })}
        </div>
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
              Beispiel-Überschrift
            </h4>
            <p style={{ color: theme.fg }}>
              Dies ist ein Beispieltext in der ausgewählten Farbpalette.
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
