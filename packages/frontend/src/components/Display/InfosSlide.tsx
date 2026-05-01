import type { SlideConfig } from '@/types/slideshow.types';
import type { Settings } from '@/types/settings.types';
import type { Media } from '@/types/media.types';
import { getDefaultSettings } from '@/types/settings.types';
import { useCompactDetector } from '@/hooks/useResponsiveLayout';
import { ShieldCheck } from 'lucide-react';
import { ResilientImage } from './ResilientImage';
import { useInfoPanelData } from '@/slides/data';

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

  // `infoId` only exists on the `infos` variant; other variants degrade
  // to "show all infos" mode by omitting it.
  const infoId = slide.type === 'infos' ? slide.infoId : undefined;
  const info = useInfoPanelData({ settings, infoId, media });
  const imageUrl = info.imageUrl;
  const isBackground = info.imageMode === 'background';

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
          // Lesbar aus Distanz: bewusst KEIN uppercase/italic/tracking-tight
          // mehr (vier Effekte gleichzeitig waren aus 3 m unleserlich).
          // Mindestens 16 px in der compact-Variante; line-height etwas
          // großzügiger für gemischte Lauflängen.
          className="font-medium border-l-[3px] overflow-hidden"
          style={{
            fontSize: '16px',
            lineHeight: '1.45',
            paddingLeft: '10px',
            borderLeft: `3px solid ${accentGreen}30`,
            color: isBackground ? 'rgba(255,255,255,0.95)' : textMuted,
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
        <ResilientImage
          src={imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          fallback={<div className="absolute inset-0 bg-linear-to-br from-spa-bg-primary to-spa-bg-secondary" />}
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent" />
        <div className="relative z-10" style={{ padding: 'clamp(12px,3%,32px)' }}>
          <div className="flex items-center" style={{ gap: 'clamp(8px,1.5%,20px)', marginBottom: 'clamp(6px,1%,16px)' }}>
            <div
              className="rounded-lg border shadow-xs shrink-0"
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
            // Background-Variante mit Foto: Fokus auf Lesbarkeit über
            // dem Bild. Kein uppercase/italic/tracking-tight mehr,
            // dafür `font-semibold` und großzügige line-height.
            className="font-semibold border-l-4 overflow-hidden"
            style={{
              fontSize: 'clamp(18px, 2.4vw, 36px)',
              lineHeight: '1.5',
              paddingLeft: 'clamp(10px, 1.2%, 18px)',
              color: 'rgba(255,255,255,0.95)',
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
            <ResilientImage
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover"
              fallback={<div className="w-full h-full min-h-[140px] bg-spa-bg-secondary" />}
            />
          </div>
        )}
        <div className="flex flex-col justify-center min-w-0 flex-1">
          <div className="flex items-center" style={{ gap: 'clamp(8px,1.5%,20px)', marginBottom: 'clamp(6px,1%,16px)' }}>
            <div
              className="rounded-lg border shadow-xs shrink-0"
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
            // Image-with-Text-Layout: gleiche Lesbarkeits-Regel wie
            // oben — kein uppercase/italic-Stack, mind. 16 px.
            className="font-semibold border-l-4 overflow-hidden"
            style={{
              fontSize: 'clamp(16px, 2.2vw, 32px)',
              lineHeight: '1.5',
              paddingLeft: 'clamp(10px, 1.2%, 18px)',
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
