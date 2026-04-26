import { useState } from 'react';
import type { ThemeColors } from '@/types/settings.types';
import { ChevronDown, ChevronUp, Pencil, RotateCcw } from 'lucide-react';

interface ColorTokenEditorProps {
  theme: ThemeColors;
  onChange: (theme: ThemeColors) => void;
  /**
   * Optional: current hero-overlay intensity multiplier (default 1).
   * When provided alongside `onHeroOverlayIntensityChange`, the editor
   * surfaces a slider in the "Effekte" section so operators can tune
   * the wash strength without picking a darker colour.
   */
  heroOverlayIntensity?: number;
  onHeroOverlayIntensityChange?: (next: number) => void;
}

/**
 * The 11 canonical color tokens every design pack consumes. Each entry
 * names the underlying SDK token, a short label, and a one-line hint
 * explaining where the colour actually shows up at runtime — so the
 * operator knows what they're changing before they pick a hue.
 */
type TokenKey =
  | 'surface'
  | 'surfaceElevated'
  | 'border'
  | 'textPrimary'
  | 'textSecondary'
  | 'textInverse'
  | 'accentPrimary'
  | 'accentSecondary'
  | 'statusLive'
  | 'statusNext'
  | 'statusWarning'
  | 'accentStripe'
  | 'heroOverlay';

interface TokenSpec {
  key: TokenKey;
  label: string;
  hint: string;
  /** Legacy field used as the read-fallback when the SDK field is unset. */
  legacyFallback?: keyof ThemeColors | Array<keyof ThemeColors>;
}

const TOKEN_GROUPS: Array<{ title: string; description: string; tokens: TokenSpec[] }> = [
  {
    title: 'Oberflächen',
    description: 'Hintergrund-Material des Displays.',
    tokens: [
      {
        key: 'surface',
        label: 'Hintergrund',
        hint: 'Haupt-Bühne des Slides — Body-Color hinter allem.',
        legacyFallback: ['dashboardBg', 'bg'],
      },
      {
        key: 'surfaceElevated',
        label: 'Karten-Fläche',
        hint: 'Innenfarbe von Karten, Aufguss-Tiles, Sub-Panels (heller als Hintergrund).',
        legacyFallback: ['cardBg', 'cellBg'],
      },
      {
        key: 'border',
        label: 'Trennlinie',
        hint: 'Card-Borders, Hairlines, dezente Strukturlinien.',
        legacyFallback: ['cardBorder', 'gridTable'],
      },
    ],
  },
  {
    title: 'Text',
    description: 'Schriftfarben für die drei Hierarchie-Stufen.',
    tokens: [
      {
        key: 'textPrimary',
        label: 'Haupttext',
        hint: 'Headlines, Sauna-Namen, Aufguss-Titel.',
        legacyFallback: ['textMain', 'fg'],
      },
      {
        key: 'textSecondary',
        label: 'Sekundärtext',
        hint: 'Labels, Aroma-Zeile, Meta-Informationen.',
        legacyFallback: ['textMuted'],
      },
      {
        key: 'textInverse',
        label: 'Inverser Text',
        hint: 'Text auf farbigem Hintergrund (z. B. „LÄUFT"-Pill, Status-Badges).',
      },
    ],
  },
  {
    title: 'Akzente',
    description: 'Brand-Farben des Packs.',
    tokens: [
      {
        key: 'accentPrimary',
        label: 'Primärakzent',
        hint: 'Brass / Gold / Tan — Sauna-Farbleiste, Headers, Brand-Akzent.',
        legacyFallback: ['accentGold', 'accent'],
      },
      {
        key: 'accentSecondary',
        label: 'Sekundärakzent',
        hint: 'Gegenakzent (Moosgrün, warmes Brass) — z. B. Feature-Chips.',
        legacyFallback: ['accentGreen'],
      },
    ],
  },
  {
    title: 'Status',
    description: 'Farben für Live-/Vorbereitung-/Nächster-Anzeigen.',
    tokens: [
      {
        key: 'statusLive',
        label: 'Läuft jetzt',
        hint: 'Live-Aufguss („LÄUFT") — Pill-Farbe und Glow-Hue.',
      },
      {
        key: 'statusNext',
        label: 'Als nächstes',
        hint: 'Nachfolgender Aufguss („GLEICH" – Next).',
      },
      {
        key: 'statusWarning',
        label: 'Vorbereitung',
        hint: 'Aufguss in Vorbereitung („GLEICH" – Prestart).',
        legacyFallback: ['statusPrestart'],
      },
    ],
  },
  {
    title: 'Effekte',
    description: 'Farben für optionale Render-Effekte (Streifen, Hero-Wash).',
    tokens: [
      {
        key: 'accentStripe',
        label: 'Akzentstreifen',
        hint: 'Vertikaler Streifen am linken Slide-Rand (wenn in der Pack-Auswahl aktiviert). Default = Primärakzent.',
      },
      {
        key: 'heroOverlay',
        label: 'Hero-Wash',
        hint: 'Tönung des dunklen Wash über dem Hintergrundbild im Aufguss-Fokus „Hero". Aufhellen lässt das Foto durchscheinen, abdunkeln verbessert die Textlesbarkeit.',
      },
    ],
  },
];

/** Pick the effective value: explicit SDK field > legacy fallback. */
function resolveTokenValue(theme: ThemeColors, spec: TokenSpec): string {
  const direct = theme[spec.key];
  if (typeof direct === 'string' && direct.length > 0) return direct;
  const fallbacks = Array.isArray(spec.legacyFallback)
    ? spec.legacyFallback
    : spec.legacyFallback
      ? [spec.legacyFallback]
      : [];
  for (const fb of fallbacks) {
    const v = theme[fb];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return '#000000';
}

/** True if the SDK field is explicitly set (not just inherited from legacy). */
function isOverridden(theme: ThemeColors, key: TokenKey): boolean {
  const v = theme[key];
  return typeof v === 'string' && v.length > 0;
}

function ColorSwatch({
  spec,
  value,
  overridden,
  onUpdate,
  onReset,
}: {
  spec: TokenSpec;
  value: string;
  overridden: boolean;
  onUpdate: (key: TokenKey, val: string) => void;
  onReset: (key: TokenKey) => void;
}) {
  return (
    <div className="group relative">
      <label className="block cursor-pointer select-none">
        <input
          type="color"
          value={value}
          onChange={(e) => onUpdate(spec.key, e.target.value)}
          aria-label={`Farbe: ${spec.label}`}
          className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
          style={{ height: '44px' }}
        />
        <div
          className="h-11 rounded-t-lg transition-[filter] group-hover:brightness-90 relative"
          style={{ backgroundColor: value }}
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg bg-black/15">
            <Pencil className="w-3 h-3 text-white drop-shadow-xs" />
          </div>
        </div>
        <div className="bg-spa-surface border border-t-0 border-spa-border rounded-b-lg px-1.5 py-1">
          <p className="text-[10px] font-semibold text-spa-text-primary truncate leading-none flex items-center gap-1">
            {spec.label}
            {overridden ? (
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-spa-primary shrink-0"
                title="Wert wurde manuell überschrieben"
                aria-label="manuell überschrieben"
              />
            ) : null}
          </p>
          <p className="text-[9px] font-mono text-spa-text-secondary mt-0.5 truncate uppercase">
            {value.replace('#', '')}
          </p>
        </div>
      </label>
      {overridden ? (
        <button
          type="button"
          onClick={() => onReset(spec.key)}
          className="absolute top-1 right-1 z-20 p-0.5 rounded bg-black/40 text-white/90 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
          title="Auf Paletten-Standard zurücksetzen"
          aria-label={`${spec.label} zurücksetzen`}
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Slider for the hero-overlay alpha multiplier. Values < 1 let more of
 * the photo show through (lighter wash); > 1 darken further. Reset
 * button restores the pack default (1).
 */
function HeroOverlayIntensitySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const isOverridden = Math.abs(value - 1) > 0.01;
  const pct = Math.round(value * 100);
  return (
    <div className="mt-3 px-2 py-2 rounded-lg border border-spa-border bg-spa-bg-secondary/40">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-spa-text-primary flex items-center gap-1">
          Hero-Wash-Stärke
          {isOverridden ? (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-spa-primary shrink-0"
              title="Wert weicht vom Pack-Standard ab"
              aria-hidden
            />
          ) : null}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono tabular-nums text-spa-text-secondary">
            {pct}%
          </span>
          {isOverridden ? (
            <button
              type="button"
              onClick={() => onChange(1)}
              className="p-0.5 rounded text-spa-text-secondary hover:text-spa-primary hover:bg-spa-bg-secondary transition-colors"
              title="Auf Pack-Standard zurücksetzen"
              aria-label="Hero-Wash-Stärke zurücksetzen"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          ) : null}
        </div>
      </div>
      <input
        type="range"
        min={0.3}
        max={1.6}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-spa-primary cursor-pointer"
        aria-label="Hero-Wash-Stärke"
      />
      <p className="text-[9px] text-spa-text-secondary/80 mt-1 leading-tight">
        Niedriger = mehr vom Hintergrundbild sichtbar. Höher = dunklerer Wash, bessere Textlesbarkeit.
      </p>
    </div>
  );
}

export function ColorTokenEditor({
  theme,
  onChange,
  heroOverlayIntensity,
  onHeroOverlayIntensityChange,
}: ColorTokenEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hintFor, setHintFor] = useState<TokenKey | null>(null);

  const updateColor = (key: TokenKey, value: string) => {
    onChange({ ...theme, [key]: value });
  };

  const resetColor = (key: TokenKey) => {
    const next = { ...theme };
    delete (next as Record<string, unknown>)[key];
    onChange(next as ThemeColors);
  };

  const activeHint = hintFor
    ? TOKEN_GROUPS.flatMap((g) => g.tokens).find((t) => t.key === hintFor)
    : null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-spa-bg-secondary border border-spa-border hover:bg-spa-surface hover:border-spa-primary/40 transition-all text-sm font-semibold text-spa-text-primary group"
      >
        <span>Einzelne Farb-Tokens anpassen</span>
        <span className="text-spa-text-secondary group-hover:text-spa-primary transition-colors">
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {showAdvanced && (
        <div className="mt-3 space-y-5">
          <p className="text-xs text-spa-text-secondary px-1">
            Klicke auf eine Farbfläche, um den Wert zu ändern. Hover für Erklärung
            wo die Farbe im Design verwendet wird. Der blaue Punkt markiert
            Werte, die vom Paletten-Standard abweichen — der Reset-Button
            (Hover) setzt sie zurück.
          </p>

          {TOKEN_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-spa-text-secondary mb-1 px-0.5">
                {group.title}
              </p>
              <p className="text-[11px] text-spa-text-secondary/80 mb-2 px-0.5">
                {group.description}
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {group.tokens.map((spec) => (
                  <div
                    key={spec.key}
                    onMouseEnter={() => setHintFor(spec.key)}
                    onMouseLeave={() => setHintFor((v) => (v === spec.key ? null : v))}
                  >
                    <ColorSwatch
                      spec={spec}
                      value={resolveTokenValue(theme, spec)}
                      overridden={isOverridden(theme, spec.key)}
                      onUpdate={updateColor}
                      onReset={resetColor}
                    />
                  </div>
                ))}
              </div>
              {/* Effekte section: append the wash-intensity slider so the
                  hero-overlay tint and its strength sit next to each other. */}
              {group.title === 'Effekte' && onHeroOverlayIntensityChange ? (
                <HeroOverlayIntensitySlider
                  value={heroOverlayIntensity ?? 1}
                  onChange={onHeroOverlayIntensityChange}
                />
              ) : null}
            </div>
          ))}

          {/* Sticky hint area — shows the description for whichever token
              the operator is hovering, so they can read the explanation
              without leaving the grid context. */}
          <div className="sticky bottom-0 -mx-1 px-3 py-2 rounded-lg bg-spa-bg-secondary border border-spa-border min-h-[2.5rem] flex items-center">
            {activeHint ? (
              <p className="text-xs text-spa-text-primary">
                <span className="font-semibold">{activeHint.label}:</span>{' '}
                <span className="text-spa-text-secondary">{activeHint.hint}</span>
              </p>
            ) : (
              <p className="text-xs text-spa-text-secondary/70 italic">
                Bewege die Maus über eine Farbe, um zu sehen wo sie im
                Design verwendet wird.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
