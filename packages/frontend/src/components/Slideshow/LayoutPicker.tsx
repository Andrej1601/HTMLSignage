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

interface LayoutPickerProps {
  layout: LayoutType;
  disabled?: boolean;
  onLayoutChange: (layout: LayoutType) => void;
}

export function LayoutPicker({
  layout,
  disabled = false,
  onLayoutChange,
}: LayoutPickerProps) {
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
    </SectionCard>
  );
}
