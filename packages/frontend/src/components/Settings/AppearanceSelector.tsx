import type {
  DesignStyle,
  SaunaDetailStyle,
} from '@/types/settings.types';
import {
  SAUNA_DETAIL_STYLE_OPTIONS,
  SCHEDULE_DESIGN_STYLE_OPTIONS,
} from '@/config/displayDesignStyles';
import { DESIGN_IDS, DEFAULT_DESIGN_ID, type DesignId } from '@/designs';
import {
  LayoutGrid,
  BookOpen,
  Flame,
  Gem,
  Layers,
  Clock,
  List,
  Columns,
  Image as ImageIcon,
  Smartphone,
} from 'lucide-react';

const STYLE_ICONS: Record<string, typeof LayoutGrid> = {
  'modern-wellness': LayoutGrid,
  'modern-timeline': Clock,
  'compact-tiles': List,
};

const SAUNA_DETAIL_ICONS: Record<string, typeof Columns> = {
  split: Columns,
  hero: ImageIcon,
  portrait: Smartphone,
};

// ─── Design-Pack list ────────────────────────────────────────────────────────
//
// Replaces the legacy "Bühne" picker. Same visual language (icon + title +
// description + radio) so operators keep the muscle-memory. The pack
// choice writes only `display.designPackId` — the old `displayAppearance`
// chrome (mineral-noir, editorial-resort etc.) is no longer touched.

interface DesignPackOption {
  id: DesignId;
  title: string;
  description: string;
  icon: typeof Layers;
}

const DESIGN_PACK_OPTIONS: DesignPackOption[] = [
  {
    id: 'aurora-thermal',
    title: 'Aurora Thermal',
    description:
      'Goldene Stunde — warme Charcoal-Bühne, polierte Messing-Akzente, Display-Serif. Das Aushängeschild.',
    icon: Flame,
  },
  {
    id: 'wellness-classic',
    title: 'Wellness Classic',
    description:
      'Klares Inter-Sans, warme Tan-Töne, kompakte Aufguss-Karten — der Standard für klassische Saunawelten.',
    icon: Layers,
  },
  {
    id: 'mineral-noir',
    title: 'Mineral Noir',
    description:
      'Architektonischer Dark-Luxus — kühles Schiefer, Platin-Typografie, kein Schnörkel.',
    icon: Gem,
  },
  {
    id: 'editorial-resort',
    title: 'Editorial Resort',
    description:
      'Inszenierte Resort-Bühne mit Karten, Lichtflächen und magazinartiger Serif-Typografie.',
    icon: BookOpen,
  },
];

interface AppearanceSelectorProps {
  designPackId?: DesignId;
  designStyle?: DesignStyle;
  saunaDetailStyle?: SaunaDetailStyle;
  /** Toggle: vertikaler Akzentstreifen am linken Rand jedes Slides. */
  accentStripes?: boolean;
  onDesignPackChange?: (packId: DesignId) => void;
  onDesignStyleChange?: (style: DesignStyle) => void;
  onSaunaDetailStyleChange?: (style: SaunaDetailStyle) => void;
  onAccentStripesChange?: (next: boolean) => void;
}

export function AppearanceSelector({
  designPackId,
  designStyle,
  saunaDetailStyle,
  accentStripes,
  onDesignPackChange,
  onDesignStyleChange,
  onSaunaDetailStyleChange,
  onAccentStripesChange,
}: AppearanceSelectorProps) {
  const activePackId =
    designPackId && DESIGN_IDS.includes(designPackId) ? designPackId : DEFAULT_DESIGN_ID;

  return (
    <div className="space-y-5">
      {/* Design-Pack — picks both the renderer pack AND syncs the legacy
          `displayAppearance` so the pre-design-pack chrome path also lines
          up with the operator's choice. */}
      <div className="bg-spa-surface rounded-xl border border-spa-border p-4 shadow-xs">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-text-secondary mb-3">
          Design-Pack
        </label>
        <div className="space-y-2" role="radiogroup" aria-label="Design-Pack">
          {DESIGN_PACK_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = activePackId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onDesignPackChange?.(option.id)}
                disabled={!onDesignPackChange}
                role="radio"
                aria-checked={isActive}
                className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spa-primary focus-visible:ring-offset-2 ${
                  isActive
                    ? 'border-spa-primary bg-spa-primary/5'
                    : 'border-spa-border hover:border-spa-primary/30 hover:bg-spa-bg-secondary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`p-1.5 rounded-lg ${
                      isActive
                        ? 'bg-spa-primary/10 text-spa-primary'
                        : 'bg-spa-bg-secondary text-spa-text-secondary'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        isActive ? 'text-spa-primary' : 'text-spa-text-primary'
                      }`}
                    >
                      {option.title}
                    </p>
                    <p className="text-[10px] text-spa-text-secondary mt-0.5">
                      {option.description}
                    </p>
                  </div>
                </div>
                <span
                  className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${
                    isActive ? 'border-spa-primary bg-spa-primary' : 'border-spa-border'
                  }`}
                >
                  {isActive && (
                    <span className="block w-full h-full rounded-full scale-50 bg-spa-surface" />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Akzentstreifen-Toggle — pack-agnostisch. Die Farbe kommt vom
            aktiven Pack (accentPrimary), der Streifen ist überall gleich. */}
        {onAccentStripesChange ? (
          <label className="mt-3 flex items-start gap-3 px-3 py-2.5 rounded-lg border border-spa-border bg-spa-bg-secondary/50 cursor-pointer hover:bg-spa-bg-secondary transition-colors">
            <input
              type="checkbox"
              checked={accentStripes === true}
              onChange={(e) => onAccentStripesChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-spa-border text-spa-primary focus:ring-spa-primary"
            />
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[12px] font-semibold text-spa-text-primary">
                Vertikale Akzentstreifen
              </span>
              <span className="text-[10px] text-spa-text-secondary leading-snug">
                Schmaler Strich am linken Rand jedes Slides in der Pack-Hauptfarbe — Mineral-Noir-Stil.
              </span>
            </span>
          </label>
        ) : null}
      </div>

      {/* Schedule Design Style */}
      <div className="bg-spa-surface rounded-xl border border-spa-border p-4 shadow-xs">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-text-secondary mb-3">
          Plan-Darstellung
        </label>
        <div className="space-y-2" role="radiogroup" aria-label="Plan-Darstellung">
          {SCHEDULE_DESIGN_STYLE_OPTIONS.map((option) => {
            const Icon = STYLE_ICONS[option.id] ?? LayoutGrid;
            const isActive = designStyle === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onDesignStyleChange?.(option.id)}
                disabled={!onDesignStyleChange}
                role="radio"
                aria-checked={isActive}
                className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spa-primary focus-visible:ring-offset-2 ${
                  isActive
                    ? 'border-spa-primary bg-spa-primary/5'
                    : 'border-spa-border hover:border-spa-primary/30 hover:bg-spa-bg-secondary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`p-1.5 rounded-lg ${isActive ? 'bg-spa-primary/10 text-spa-primary' : 'bg-spa-bg-secondary text-spa-text-secondary'}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${isActive ? 'text-spa-primary' : 'text-spa-text-primary'}`}>
                      {option.title}
                    </p>
                    <p className="text-[10px] text-spa-text-secondary mt-0.5">{option.description}</p>
                  </div>
                </div>
                <span className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${
                  isActive ? 'border-spa-primary bg-spa-primary' : 'border-spa-border'
                }`}>
                  {isActive && <span className="block w-full h-full rounded-full scale-50 bg-spa-surface" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sauna-Detail (Aufguss-Fokus) Style */}
      <div className="bg-spa-surface rounded-xl border border-spa-border p-4 shadow-xs">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-text-secondary mb-3">
          Aufguss-Fokus
        </label>
        <div className="space-y-2" role="radiogroup" aria-label="Aufguss-Fokus">
          {SAUNA_DETAIL_STYLE_OPTIONS.map((option) => {
            const Icon = SAUNA_DETAIL_ICONS[option.id] ?? Columns;
            const isActive = saunaDetailStyle === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSaunaDetailStyleChange?.(option.id)}
                disabled={!onSaunaDetailStyleChange}
                role="radio"
                aria-checked={isActive}
                className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spa-primary focus-visible:ring-offset-2 ${
                  isActive
                    ? 'border-spa-primary bg-spa-primary/5'
                    : 'border-spa-border hover:border-spa-primary/30 hover:bg-spa-bg-secondary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`p-1.5 rounded-lg ${isActive ? 'bg-spa-primary/10 text-spa-primary' : 'bg-spa-bg-secondary text-spa-text-secondary'}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${isActive ? 'text-spa-primary' : 'text-spa-text-primary'}`}>
                      {option.title}
                    </p>
                    <p className="text-[10px] text-spa-text-secondary mt-0.5">{option.description}</p>
                  </div>
                </div>
                <span className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${
                  isActive ? 'border-spa-primary bg-spa-primary' : 'border-spa-border'
                }`}>
                  {isActive && <span className="block w-full h-full rounded-full scale-50 bg-spa-surface" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
