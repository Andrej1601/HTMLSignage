import { useState } from 'react';
import type { ThemeColors } from '@/types/settings.types';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ColorTokenEditorProps {
  theme: ThemeColors;
  onChange: (theme: ThemeColors) => void;
}

const COLOR_GROUPS = [
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
      { key: 'zebra1' as keyof ThemeColors, label: 'Fläche A', description: 'Erste alternierende Fläche' },
      { key: 'zebra2' as keyof ThemeColors, label: 'Fläche B', description: 'Zweite alternierende Fläche' },
      { key: 'timeZebra1' as keyof ThemeColors, label: 'Reserve A', description: 'Reservierter Altwert' },
      { key: 'timeZebra2' as keyof ThemeColors, label: 'Reserve B', description: 'Reservierter Altwert' },
    ],
  },
  {
    title: 'Plan-Header (klassisch)',
    colors: [
      { key: 'headRowBg' as keyof ThemeColors, label: 'Header-Hintergrund', description: 'Kopfzeile im klassischen Plan-Layout' },
      { key: 'headRowFg' as keyof ThemeColors, label: 'Header-Text', description: 'Textfarbe im klassischen Plan-Layout' },
      { key: 'cornerBg' as keyof ThemeColors, label: 'Plan-Ecke Hintergrund', description: 'Reservierter Altwert' },
      { key: 'cornerFg' as keyof ThemeColors, label: 'Plan-Ecke Text', description: 'Reservierter Altwert' },
    ],
  },
  {
    title: 'Spezial & Legacy',
    colors: [
      { key: 'flame' as keyof ThemeColors, label: 'Flammen-Symbol', description: 'Aufguss-/Hitze-Symbol und Badge-Akzent' },
      { key: 'boxFg' as keyof ThemeColors, label: 'Tabellen-/Box-Text', description: 'Text in klassischen Planboxen' },
    ],
  },
  {
    title: 'Display-Oberfläche',
    colors: [
      { key: 'dashboardBg' as keyof ThemeColors, label: 'Display-Grundfläche', description: 'Hintergrund der modernen Display-Ansicht' },
      { key: 'cardBg' as keyof ThemeColors, label: 'Kartenfläche', description: 'Hintergrund von Karten und Modulen' },
      { key: 'cardBorder' as keyof ThemeColors, label: 'Karten-Trenner', description: 'Rahmen zwischen Karten und Modulen' },
      { key: 'textMain' as keyof ThemeColors, label: 'Primärtext', description: 'Haupttext in modernen Layouts' },
      { key: 'textMuted' as keyof ThemeColors, label: 'Sekundärtext', description: 'Dezentere Texte und Metadaten' },
      { key: 'accentGold' as keyof ThemeColors, label: 'Akzent warm', description: 'Warmer Hauptakzent' },
      { key: 'accentGreen' as keyof ThemeColors, label: 'Akzent kühl', description: 'Kühler Zweitakzent' },
      { key: 'statusLive' as keyof ThemeColors, label: 'Status: Läuft', description: 'Aktiver Live-Indikator' },
      { key: 'statusNext' as keyof ThemeColors, label: 'Status: Nächster', description: 'Badge für den nächsten Slot' },
      { key: 'statusPrestart' as keyof ThemeColors, label: 'Status: Gleich', description: 'Badge für bald startende Slots' },
    ],
  },
];

export function ColorTokenEditor({ theme, onChange }: ColorTokenEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateColor = (key: keyof ThemeColors, value: string) => {
    onChange({ ...theme, [key]: value });
  };

  return (
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
            Einige Farbschlüssel stammen aus älteren Layouts. Die Namen beschreiben die heutige Wirkung im Display.
          </div>
          {COLOR_GROUPS.map((group, groupIndex) => (
            <div key={groupIndex}>
              <h4 className="font-semibold text-spa-text-primary mb-3">{group.title}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.colors.map(({ key, label, description }) => (
                  <div key={key} className="flex items-center gap-3">
                    <input
                      type="color"
                      value={theme[key] || '#000000'}
                      onChange={(e) => updateColor(key, e.target.value)}
                      aria-label={`Farbe: ${label}`}
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
  );
}
