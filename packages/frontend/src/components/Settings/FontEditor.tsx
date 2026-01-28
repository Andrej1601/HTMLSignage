import type { FontSettings } from '@/types/settings.types';
import { Type } from 'lucide-react';

interface FontEditorProps {
  fonts: FontSettings;
  onChange: (fonts: FontSettings) => void;
}

export function FontEditor({ fonts, onChange }: FontEditorProps) {
  const updateFont = (key: keyof FontSettings, value: number) => {
    onChange({ ...fonts, [key]: value });
  };

  const fontScales = [
    { key: 'fontScale' as keyof FontSettings, label: 'Basis-Schriftgröße', min: 0.5, max: 2, step: 0.05, default: 1 },
    { key: 'h1Scale' as keyof FontSettings, label: 'Überschrift 1', min: 0.8, max: 3, step: 0.1, default: 1.5 },
    { key: 'h2Scale' as keyof FontSettings, label: 'Überschrift 2', min: 0.8, max: 2.5, step: 0.1, default: 1.2 },
    { key: 'overviewTitleScale' as keyof FontSettings, label: 'Übersicht Titel', min: 0.5, max: 2, step: 0.05, default: 1 },
    { key: 'overviewHeadScale' as keyof FontSettings, label: 'Übersicht Kopfzeile', min: 0.5, max: 2, step: 0.05, default: 1 },
    { key: 'overviewCellScale' as keyof FontSettings, label: 'Übersicht Zellen', min: 0.5, max: 2, step: 0.05, default: 1 },
    { key: 'overviewTimeScale' as keyof FontSettings, label: 'Übersicht Zeit', min: 0.5, max: 2, step: 0.05, default: 1 },
    { key: 'tileTextScale' as keyof FontSettings, label: 'Kachel Text', min: 0.4, max: 3, step: 0.1, default: 1 },
    { key: 'tileTimeScale' as keyof FontSettings, label: 'Kachel Zeit', min: 0.5, max: 4, step: 0.1, default: 1 },
    { key: 'badgeTextScale' as keyof FontSettings, label: 'Badge Text', min: 0.5, max: 1.5, step: 0.05, default: 0.85 },
    { key: 'flameScale' as keyof FontSettings, label: 'Flammen-Icon', min: 0.5, max: 3, step: 0.1, default: 1 },
  ];

  const fontWeights = [
    { key: 'tileTimeWeight' as keyof FontSettings, label: 'Zeit-Schriftstärke', min: 100, max: 900, step: 100, default: 600 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Type className="w-5 h-5 text-spa-primary" />
        <h3 className="text-lg font-semibold text-spa-text-primary">Schrift-Einstellungen</h3>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-spa-text-primary">Schriftgrößen-Skalierung</h4>
        {fontScales.map((config) => {
          const value = fonts[config.key] ?? config.default;
          return (
            <div key={config.key.toString()} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-spa-text-primary">{config.label}</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-spa-text-secondary w-12 text-right">
                    {value.toFixed(2)}
                  </span>
                  {value !== config.default && (
                    <button
                      onClick={() => updateFont(config.key, config.default)}
                      className="text-xs text-spa-accent hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min={config.min}
                max={config.max}
                step={config.step}
                value={value}
                onChange={(e) => updateFont(config.key, parseFloat(e.target.value))}
                className="w-full h-2 bg-spa-bg-secondary rounded-lg appearance-none cursor-pointer accent-spa-primary"
              />
              <div className="flex justify-between text-xs text-spa-text-secondary">
                <span>{config.min}</span>
                <span>{config.max}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-spa-text-primary">Schriftstärke</h4>
        {fontWeights.map((config) => {
          const value = fonts[config.key] ?? config.default;
          return (
            <div key={config.key.toString()} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-spa-text-primary">{config.label}</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-spa-text-secondary w-12 text-right">
                    {value}
                  </span>
                  {value !== config.default && (
                    <button
                      onClick={() => updateFont(config.key, config.default)}
                      className="text-xs text-spa-accent hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min={config.min}
                max={config.max}
                step={config.step}
                value={value}
                onChange={(e) => updateFont(config.key, parseInt(e.target.value))}
                className="w-full h-2 bg-spa-bg-secondary rounded-lg appearance-none cursor-pointer accent-spa-primary"
              />
              <div className="flex justify-between text-xs text-spa-text-secondary">
                <span>Dünn</span>
                <span>Fett</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-6 bg-spa-bg-secondary rounded-lg">
        <h4 className="font-medium text-spa-text-primary mb-4">Vorschau</h4>
        <div className="space-y-3">
          <div style={{ fontSize: (fonts.h1Scale || 1.5) * 16 + 'px', fontWeight: fonts.tileTimeWeight || 600 }}>
            Überschrift H1 - Beispieltext
          </div>
          <div style={{ fontSize: (fonts.h2Scale || 1.2) * 16 + 'px' }}>
            Überschrift H2 - Beispieltext
          </div>
          <div style={{ fontSize: (fonts.fontScale || 1) * 16 + 'px' }}>
            Normaler Text - Dies ist ein Beispieltext in der Basis-Schriftgröße.
          </div>
          <div style={{ fontSize: (fonts.badgeTextScale || 0.85) * 16 + 'px' }}>
            Badge Text - Klein und kompakt
          </div>
        </div>
      </div>
    </div>
  );
}
