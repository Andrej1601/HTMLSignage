import { useState } from 'react';
import type { ThemeColors } from '@/types/settings.types';
import { COLOR_PALETTES } from '@/types/settings.types';
import { Palette, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';

interface ThemeEditorProps {
  theme: ThemeColors;
  onChange: (theme: ThemeColors) => void;
}

export function ThemeEditor({ theme, onChange }: ThemeEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const applyPalette = (paletteColors: Partial<ThemeColors>) => {
    onChange({ ...theme, ...paletteColors });
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
  ];

  return (
    <div className="space-y-6">
      {/* Predefined Palettes */}
      <div>
        <h3 className="text-lg font-semibold text-spa-text-primary mb-3 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Farbpaletten
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {COLOR_PALETTES.map((palette, index) => (
            <button
              key={index}
              onClick={() => applyPalette(palette.colors)}
              className="p-4 border-2 border-spa-secondary/20 rounded-lg hover:border-spa-accent hover:shadow-md transition-all text-left group"
            >
              <div className="font-medium text-spa-text-primary mb-2 group-hover:text-spa-accent transition-colors">
                {palette.name}
              </div>
              <div className="flex gap-1">
                {palette.colors.bg && (
                  <div className="w-8 h-8 rounded" style={{ backgroundColor: palette.colors.bg }} />
                )}
                {palette.colors.fg && (
                  <div className="w-8 h-8 rounded border border-gray-300" style={{ backgroundColor: palette.colors.fg }} />
                )}
                {palette.colors.accent && (
                  <div className="w-8 h-8 rounded" style={{ backgroundColor: palette.colors.accent }} />
                )}
              </div>
            </button>
          ))}
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
