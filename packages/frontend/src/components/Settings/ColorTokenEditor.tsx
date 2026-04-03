import { useState } from 'react';
import type { ThemeColors } from '@/types/settings.types';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';

interface ColorTokenEditorProps {
  theme: ThemeColors;
  onChange: (theme: ThemeColors) => void;
}

const COLOR_GROUPS: { title: string; colors: { key: keyof ThemeColors; label: string }[] }[] = [
  {
    title: 'Basis',
    colors: [
      { key: 'bg', label: 'Hintergrund' },
      { key: 'fg', label: 'Text' },
      { key: 'accent', label: 'Primärakzent' },
      { key: 'gridTable', label: 'Linien' },
      { key: 'cellBg', label: 'Innenfläche' },
      { key: 'timeColBg', label: 'Sekundärakzent' },
    ],
  },
  {
    title: 'Wechselflächen',
    colors: [
      { key: 'zebra1', label: 'Fläche A' },
      { key: 'zebra2', label: 'Fläche B' },
      { key: 'timeZebra1', label: 'Reserve A' },
      { key: 'timeZebra2', label: 'Reserve B' },
    ],
  },
  {
    title: 'Plan-Header',
    colors: [
      { key: 'headRowBg', label: 'Header BG' },
      { key: 'headRowFg', label: 'Header Text' },
      { key: 'cornerBg', label: 'Ecke BG' },
      { key: 'cornerFg', label: 'Ecke Text' },
    ],
  },
  {
    title: 'Display-Oberfläche',
    colors: [
      { key: 'dashboardBg', label: 'Display BG' },
      { key: 'cardBg', label: 'Karte' },
      { key: 'cardBorder', label: 'Rahmen' },
      { key: 'textMain', label: 'Primärtext' },
      { key: 'textMuted', label: 'Sekundärtext' },
      { key: 'accentGold', label: 'Akzent warm' },
      { key: 'accentGreen', label: 'Akzent kühl' },
      { key: 'statusLive', label: 'Läuft' },
      { key: 'statusNext', label: 'Nächster' },
      { key: 'statusPrestart', label: 'Gleich' },
    ],
  },
  {
    title: 'Spezial',
    colors: [
      { key: 'flame', label: 'Flamme' },
      { key: 'boxFg', label: 'Box-Text' },
    ],
  },
];

function ColorSwatch({
  colorKey,
  label,
  value,
  onUpdate,
}: {
  colorKey: keyof ThemeColors;
  label: string;
  value: string;
  onUpdate: (key: keyof ThemeColors, val: string) => void;
}) {
  return (
    <label className="group relative cursor-pointer select-none">
      {/* Native color input hidden behind swatch */}
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onUpdate(colorKey, e.target.value)}
        aria-label={`Farbe: ${label}`}
        className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
        style={{ height: '100%' }}
      />
      {/* Swatch block */}
      <div
        className="h-11 rounded-t-lg transition-[filter] group-hover:brightness-90"
        style={{ backgroundColor: value || '#000000' }}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg bg-black/15">
          <Pencil className="w-3 h-3 text-white drop-shadow-sm" />
        </div>
      </div>
      {/* Label bar */}
      <div className="bg-white border border-t-0 border-stone-200 rounded-b-lg px-1.5 py-1">
        <p className="text-[10px] font-semibold text-stone-700 truncate leading-none">{label}</p>
        <p className="text-[9px] font-mono text-stone-400 mt-0.5 truncate uppercase">
          {(value || '#000000').replace('#', '')}
        </p>
      </div>
    </label>
  );
}

export function ColorTokenEditor({ theme, onChange }: ColorTokenEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateColor = (key: keyof ThemeColors, value: string) => {
    onChange({ ...theme, [key]: value });
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 hover:bg-white hover:border-spa-primary/40 transition-all text-sm font-semibold text-stone-700 group"
      >
        <span>Einzelne Farb-Tokens anpassen</span>
        <span className="text-spa-text-secondary group-hover:text-spa-primary transition-colors">
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {showAdvanced && (
        <div className="mt-3 space-y-5">
          <p className="text-xs text-stone-500 px-1">
            Klicke auf eine Farbfläche, um den Wert direkt im Browser-Picker zu ändern.
          </p>
          {COLOR_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 px-0.5">
                {group.title}
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {group.colors.map(({ key, label }) => (
                  <ColorSwatch
                    key={key}
                    colorKey={key}
                    label={label}
                    value={theme[key] || '#000000'}
                    onUpdate={updateColor}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
