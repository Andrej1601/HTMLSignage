import { LAYOUT_OPTIONS } from '@/types/slideshow.types';
import type { LayoutType } from '@/types/slideshow.types';
import { SectionCard } from '@/components/SectionCard';
import { Layout } from 'lucide-react';
import clsx from 'clsx';

/** CSS-based layout preview thumbnails matching the provided design mockups */
function LayoutPreview({ layout }: { layout: LayoutType }) {
  const frame =
    'w-full aspect-square rounded-xl overflow-hidden relative p-1';
  const frameGradient: React.CSSProperties = {
    background: 'linear-gradient(145deg, #C9956B, #9E6B47 40%, #7A4E30 70%, #C9956B)',
    boxShadow: 'inset 0 1px 2px rgba(255,220,180,0.4), 0 2px 6px rgba(0,0,0,0.25)',
  };
  const inner = 'w-full h-full rounded-lg overflow-hidden flex';
  const label = 'text-[9px] font-black text-white/90 drop-shadow-xs';

  switch (layout) {
    case 'split-view':
      return (
        <div className={frame} style={frameGradient}>
          <div className={inner} style={{ gap: '2px' }}>
            <div className="flex-1 rounded-l-md flex flex-col items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7B4B2A, #9E6B47)' }}>
              <span className="text-white/90 text-sm font-black">50%</span>
              <span className={label}>L</span>
            </div>
            <div className="flex-1 rounded-r-md flex flex-col items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #C19A6B, #D4AA78)' }}>
              <span className="text-white/90 text-sm font-black">50%</span>
              <span className={label}>R</span>
            </div>
          </div>
        </div>
      );
    case 'full-rotation':
      return (
        <div className={frame} style={frameGradient}>
          <div className={`${inner} items-center justify-center rounded-md`}
            style={{ background: 'linear-gradient(135deg, #A0714F, #C08060)' }}>
            <span className="text-white/90 text-lg font-black tracking-wide">FULL</span>
          </div>
        </div>
      );
    case 'triple-view':
      return (
        <div className={frame} style={frameGradient}>
          <div className={inner} style={{ gap: '2px' }}>
            <div className="flex flex-col items-center justify-center rounded-l-md"
              style={{ flex: '0 0 65%', background: 'linear-gradient(135deg, #A0714F, #C08060)' }}>
              <span className="text-white/90 text-[10px] font-black">LINKS</span>
              <span className={label}>(70%)</span>
            </div>
            <div className="flex-1 flex flex-col" style={{ gap: '2px' }}>
              <div className="flex-1 rounded-tr-md flex flex-col items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #7B4B2A, #9E6B47)' }}>
                <span className={label}>RECHTS</span>
                <span className={label}>O.</span>
              </div>
              <div className="flex-1 rounded-br-md flex flex-col items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #6B7B8D, #8B9DAF)' }}>
                <span className={label}>UNTEN</span>
              </div>
            </div>
          </div>
        </div>
      );
    case 'grid-2x2':
      return (
        <div className={frame} style={frameGradient}>
          <div className="w-full h-full rounded-md overflow-hidden grid grid-cols-2 grid-rows-2" style={{ gap: '2px' }}>
            <div className="flex flex-col items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #A0714F, #C08060)' }}>
              <span className="text-white/90 text-sm font-black">1</span>
              <span className={label}>25%</span>
            </div>
            <div className="flex flex-col items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7B4B2A, #9E6B47)' }}>
              <span className="text-white/90 text-sm font-black">2</span>
              <span className={label}>25%</span>
            </div>
            <div className="flex flex-col items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6B7B8D, #8B9DAF)' }}>
              <span className="text-white/90 text-sm font-black">3</span>
              <span className={label}>25%</span>
            </div>
            <div className="flex flex-col items-center justify-center"
              style={{ background: 'linear-gradient(145deg, #B8866B, #C9956B)' }}>
              <span className="text-white/90 text-sm font-black">4</span>
              <span className={label}>25%</span>
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

type PersistentZonePosition = 'left' | 'right' | 'top' | 'bottom';

const ZONE_POSITIONS: { value: PersistentZonePosition; label: string }[] = [
  { value: 'left', label: 'Links' },
  { value: 'right', label: 'Rechts' },
  { value: 'top', label: 'Oben' },
  { value: 'bottom', label: 'Unten' },
];

interface LayoutPickerProps {
  layout: LayoutType;
  disabled?: boolean;
  onLayoutChange: (layout: LayoutType) => void;
  persistentZonePosition?: PersistentZonePosition;
  persistentZoneSize?: number;
  onPersistentZoneChange?: (patch: {
    persistentZonePosition?: PersistentZonePosition;
    persistentZoneSize?: number;
  }) => void;
}

export function LayoutPicker({
  layout,
  disabled = false,
  onLayoutChange,
  persistentZonePosition,
  persistentZoneSize,
  onPersistentZoneChange,
}: LayoutPickerProps) {
  const activeOption = LAYOUT_OPTIONS.find((option) => option.type === layout);
  const showZoneControls = Boolean(activeOption?.supportsPersistentZone && onPersistentZoneChange);

  return (
    <SectionCard title="Display Layout" icon={Layout}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {LAYOUT_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.type}
            onClick={() => onLayoutChange(option.type)}
            disabled={disabled}
            className={clsx(
              'group flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all disabled:opacity-50',
              'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spa-primary focus-visible:ring-offset-2',
              layout === option.type
                ? 'border-spa-primary bg-spa-primary/5 shadow-md ring-2 ring-spa-primary/20'
                : 'border-spa-bg-secondary hover:border-spa-primary/50 hover:shadow-xs'
            )}
          >
            <div className="w-full max-w-[120px]">
              <LayoutPreview layout={option.type} />
            </div>
            <div className="text-center">
              <div className={clsx(
                'font-semibold text-sm mb-0.5',
                layout === option.type ? 'text-spa-primary' : 'text-spa-text-primary'
              )}>
                {option.label}
              </div>
              <div className="text-[11px] text-spa-text-secondary leading-snug">{option.description}</div>
            </div>
          </button>
        ))}
      </div>

      {showZoneControls && (
        <div className="mt-5 rounded-xl border border-spa-border bg-spa-bg-primary/30 p-4 space-y-4">
          <div className="text-sm font-semibold text-spa-text-primary">Persistenter Bereich</div>

          <div>
            <label className="mb-1.5 block text-xs text-spa-text-secondary">Position</label>
            <div className="flex flex-wrap gap-1.5">
              {ZONE_POSITIONS.map(({ value, label }) => {
                const active = (persistentZonePosition ?? 'left') === value;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled}
                    aria-pressed={active}
                    onClick={() => onPersistentZoneChange?.({ persistentZonePosition: value })}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50',
                      'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-spa-primary',
                      active
                        ? 'border-spa-primary bg-spa-primary/10 text-spa-primary'
                        : 'border-spa-border bg-spa-surface text-spa-text-secondary hover:border-spa-primary/40',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-spa-text-secondary">Größe des persistenten Bereichs</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="30"
                max="70"
                step="5"
                value={persistentZoneSize ?? 50}
                onChange={(e) => onPersistentZoneChange?.({ persistentZoneSize: parseInt(e.target.value, 10) || 50 })}
                disabled={disabled}
                className="flex-1 accent-spa-primary disabled:opacity-50"
              />
              <span className="w-12 shrink-0 text-right text-sm font-semibold text-spa-text-primary">
                {persistentZoneSize ?? 50}%
              </span>
            </div>
            <p className="mt-1 text-xs text-spa-text-secondary">Anteil des persistenten Bereichs; der Rest gehört dem rotierenden Content.</p>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
