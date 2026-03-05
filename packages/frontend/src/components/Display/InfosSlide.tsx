import type { SlideConfig } from '@/types/slideshow.types';
import type { Settings, InfoItem } from '@/types/settings.types';
import type { Media } from '@/types/media.types';
import { getDefaultSettings } from '@/types/settings.types';
import { getMediaUploadUrl } from '@/utils/mediaUrl';
import { useCompactDetector } from '@/hooks/useResponsiveLayout';
import { ShieldCheck } from 'lucide-react';

interface InfosSlideProps {
  slide: SlideConfig;
  settings: Settings;
  media?: Media[];
}

export function InfosSlide({ slide, settings, media }: InfosSlideProps) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;
  const { containerRef, compact } = useCompactDetector(250);

  const accentGold = theme.accentGold || theme.accent || '#A68A64';
  const accentGreen = theme.accentGreen || theme.timeColBg || '#8F9779';
  const textMain = theme.textMain || theme.fg || '#3E2723';
  const textMuted = theme.textMuted || theme.fg || '#5D4037';

  const infos: InfoItem[] = settings.infos || [];
  const selected = slide.infoId ? infos.find((i) => i.id === slide.infoId) : null;
  const fallback = infos[0] || { id: 'default', title: 'Wellness Tipp', text: 'Bitte beachten Sie unsere Hinweise für einen angenehmen Aufenthalt.' };
  const info = selected || fallback;
  const imageUrl = info.imageId ? getMediaUploadUrl(media, info.imageId) : null;
  const isBackground = info.imageMode === 'background' && imageUrl;

  if (compact) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full flex flex-col justify-center overflow-hidden"
        style={{ padding: '6px 14px' }}
      >
        <h4
          className="font-black uppercase truncate shrink-0"
          style={{ fontSize: '11px', letterSpacing: '0.25em', color: accentGold, marginBottom: '4px' }}
        >
          <ShieldCheck style={{ width: '13px', height: '13px', color: accentGreen, display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
          {info.title || 'Info'}
        </h4>
        <p
          className="font-bold uppercase tracking-tight italic border-l-3 overflow-hidden"
          style={{
            fontSize: '14px',
            lineHeight: '1.35',
            paddingLeft: '8px',
            borderLeft: `3px solid ${accentGreen}30`,
            color: isBackground ? 'rgba(255,255,255,0.9)' : textMuted,
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {info.text}
        </p>
      </div>
    );
  }

  if (isBackground) {
    return (
      <div ref={containerRef} className="w-full h-full relative flex flex-col justify-end overflow-hidden">
        <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="relative z-10" style={{ padding: 'clamp(12px,3%,32px)' }}>
          <div className="flex items-center" style={{ gap: 'clamp(8px,1.5%,20px)', marginBottom: 'clamp(6px,1%,16px)' }}>
            <div
              className="rounded-lg border shadow-sm shrink-0"
              style={{
                padding: 'clamp(6px, 1%, 14px)',
                backgroundColor: `${accentGreen}20`,
                borderColor: `${accentGreen}30`,
              }}
            >
              <ShieldCheck style={{ width: 'clamp(16px, 2.5vw, 32px)', height: 'clamp(16px, 2.5vw, 32px)', color: accentGreen }} />
            </div>
            <h4
              className="font-black uppercase truncate"
              style={{ fontSize: 'clamp(10px, 1.5vw, 20px)', letterSpacing: '0.3em', color: '#FFFFFF' }}
            >
              {info.title || 'Info'}
            </h4>
          </div>
          <p
            className="font-bold uppercase tracking-tight italic border-l-4 overflow-hidden"
            style={{
              fontSize: 'clamp(14px, 2.2vw, 32px)',
              lineHeight: '1.6',
              paddingLeft: 'clamp(8px, 1%, 16px)',
              color: 'rgba(255,255,255,0.9)',
              borderLeftColor: `${accentGreen}40`,
              display: '-webkit-box',
              WebkitLineClamp: 6,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {info.text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full flex items-center overflow-hidden" style={{ padding: 'clamp(8px, 2%, 24px)' }}>
      <div className="flex items-center w-full" style={{ gap: imageUrl ? 'clamp(12px,3%,32px)' : '0' }}>
        {imageUrl && (
          <div className="shrink-0 rounded-xl overflow-hidden shadow-md" style={{ width: '35%', maxHeight: '80%' }}>
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex flex-col justify-center min-w-0 flex-1">
          <div className="flex items-center" style={{ gap: 'clamp(8px,1.5%,20px)', marginBottom: 'clamp(6px,1%,16px)' }}>
            <div
              className="rounded-lg border shadow-sm shrink-0"
              style={{
                padding: 'clamp(6px, 1%, 14px)',
                backgroundColor: `${accentGreen}10`,
                borderColor: `${accentGreen}20`,
              }}
            >
              <ShieldCheck style={{ width: 'clamp(16px, 2.5vw, 32px)', height: 'clamp(16px, 2.5vw, 32px)', color: accentGreen }} />
            </div>
            <h4
              className="font-black uppercase truncate"
              style={{ fontSize: 'clamp(10px, 1.5vw, 20px)', letterSpacing: '0.3em', color: accentGold }}
            >
              {info.title || 'Info'}
            </h4>
          </div>
          <p
            className="font-bold uppercase tracking-tight italic border-l-4 overflow-hidden"
            style={{
              fontSize: 'clamp(14px, 2.2vw, 32px)',
              lineHeight: '1.6',
              paddingLeft: 'clamp(8px, 1%, 16px)',
              color: textMuted,
              borderLeftColor: `${accentGreen}20`,
              display: '-webkit-box',
              WebkitLineClamp: 6,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {info.text}
          </p>
        </div>
      </div>
      <div className="sr-only" style={{ color: textMain }} />
    </div>
  );
}
