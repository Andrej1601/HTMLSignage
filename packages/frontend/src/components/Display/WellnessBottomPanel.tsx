import { memo, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Calendar, ShieldCheck } from 'lucide-react';
import type { Settings, ThemeColors } from '@/types/settings.types';
import { isEditorialDisplayAppearance } from '@/config/displayDesignStyles';
import type { Media } from '@/types/media.types';
import { getDefaultSettings } from '@/types/settings.types';
import { getMediaUploadUrl } from '@/utils/mediaUrl';
import {
  formatEventDateDE,
  formatEventTimeRangeDE,
  getUpcomingOrActiveEvents,
  withAlpha,
} from './wellnessDisplayUtils';
import { ResilientImage } from './ResilientImage';

const INTERVAL_MS = 8000;

interface WellnessBottomPanelProps {
  displayAppearance?: string;
  settings: Settings;
  theme?: ThemeColors;
  media?: Media[];
}

interface AnimatedWellnessPanelProps {
  children: ReactNode;
}

function AnimatedWellnessPanel({ children }: AnimatedWellnessPanelProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const style = useMemo<CSSProperties>(() => ({
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0px)' : 'translateY(20px)',
    transition: 'opacity 0.45s ease, transform 0.45s ease',
    willChange: 'opacity, transform',
  }), [isVisible]);

  return (
    <div className="h-full flex flex-col justify-center" style={style}>
      {children}
    </div>
  );
}

export const WellnessBottomPanel = memo(function WellnessBottomPanel({ displayAppearance, settings, theme, media }: WellnessBottomPanelProps) {
  const defaults = getDefaultSettings();
  const resolvedTheme = theme || (settings.theme || defaults.theme!) as ThemeColors;

  const [mode, setMode] = useState<'TIPS' | 'EVENTS'>('TIPS');
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setMode((p) => {
        const next = p === 'TIPS' ? 'EVENTS' : 'TIPS';
        if (next === 'TIPS') {
          setTipIndex((i) => i + 1);
        }
        return next;
      });
    }, INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  const tips = (settings.infos && settings.infos.length > 0) ? settings.infos : (defaults.infos || []);
  const tip = tips.length > 0
    ? tips[tipIndex % tips.length]
    : { id: 'fallback', title: 'Wellness Tipp', text: 'Bitte beachten Sie unsere Hinweise für einen angenehmen Aufenthalt.' };

  const events = getUpcomingOrActiveEvents(settings, new Date());

  const accentGold = resolvedTheme.accentGold || resolvedTheme.accent || '#A68A64';
  const accentGreen = resolvedTheme.accentGreen || resolvedTheme.timeColBg || '#8F9779';
  const textMain = resolvedTheme.textMain || resolvedTheme.fg || '#3E2723';
  const textMuted = resolvedTheme.textMuted || resolvedTheme.fg || '#5D4037';
  const cardBg = resolvedTheme.cardBg || resolvedTheme.cellBg || '#FFFFFF';
  const cardBorder = resolvedTheme.cardBorder || resolvedTheme.gridTable || '#EBE5D3';
  const isEditorial = isEditorialDisplayAppearance(displayAppearance);

  if (isEditorial) {
    return (
      <div className="flex h-full flex-col justify-center relative">
        {mode === 'TIPS' ? (
          <AnimatedWellnessPanel key="tips">
            <div className="grid h-full grid-cols-[minmax(0,1.5fr)_minmax(14rem,0.9fr)] gap-4">
              <div
                className="flex min-h-0 flex-col justify-center rounded-[1.8rem] border px-6 py-5"
                style={{
                  backgroundColor: withAlpha(cardBg, 0.56),
                  borderColor: withAlpha(cardBorder, 0.55),
                }}
              >
                <div
                  className="mb-4 text-[11px] font-black uppercase tracking-[0.34em]"
                  style={{ color: accentGold }}
                >
                  Editorial Hinweis
                </div>
                <div
                  className="text-[28px] font-semibold leading-[1.15] tracking-[-0.03em]"
                  style={{ color: textMain }}
                >
                  {tip.title || 'Info'}
                </div>
                <p
                  className="mt-4 text-[16px] leading-relaxed"
                  style={{ color: textMuted }}
                >
                  {tip.text}
                </p>
              </div>

              <div
                className="rounded-[1.8rem] border px-5 py-5"
                style={{
                  backgroundColor: withAlpha(accentGreen, 0.08),
                  borderColor: withAlpha(accentGreen, 0.26),
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="rounded-2xl border p-3"
                    style={{
                      backgroundColor: withAlpha(accentGreen, 0.12),
                      borderColor: withAlpha(accentGreen, 0.24),
                    }}
                  >
                    <ShieldCheck className="h-5 w-5" style={{ color: accentGreen }} />
                  </div>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: accentGreen }}>
                      Service
                    </div>
                    <div className="mt-1 text-sm font-semibold" style={{ color: textMain }}>
                      Wohlfühlregeln
                    </div>
                  </div>
                </div>
                <div className="mt-5 text-sm leading-relaxed" style={{ color: textMuted }}>
                  Hinweise und Wellness-Etikette wechseln automatisch mit den kommenden Events.
                </div>
              </div>
            </div>
          </AnimatedWellnessPanel>
        ) : (
          <AnimatedWellnessPanel key="events">
            <div className="grid h-full grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] gap-4">
              <div
                className="rounded-[1.8rem] border px-5 py-5"
                style={{
                  backgroundColor: withAlpha(accentGold, 0.08),
                  borderColor: withAlpha(accentGold, 0.28),
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="rounded-2xl border p-3"
                    style={{
                      backgroundColor: withAlpha(accentGold, 0.12),
                      borderColor: withAlpha(accentGold, 0.22),
                    }}
                  >
                    <Calendar className="h-5 w-5" style={{ color: accentGold }} />
                  </div>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: accentGold }}>
                      Editorial Agenda
                    </div>
                    <div className="mt-1 text-sm font-semibold" style={{ color: textMain }}>
                      Kommende Highlights
                    </div>
                  </div>
                </div>
              <div className="mt-5 text-sm leading-relaxed" style={{ color: textMuted }}>
                Die rechte Bühne zeigt saisonale Highlights, Aktionen und kommende Programmpunkte.
              </div>
            </div>

              <div className="grid min-h-0 grid-cols-1 gap-3">
                {events.length === 0 ? (
                  <div
                    className="flex h-full items-center rounded-[1.8rem] border px-5 py-5"
                    style={{
                      backgroundColor: withAlpha(cardBg, 0.56),
                      borderColor: withAlpha(cardBorder, 0.55),
                      color: textMain,
                    }}
                  >
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.34em]" style={{ color: accentGold }}>
                        Noch ruhig
                      </div>
                      <div className="mt-3 text-xl font-semibold tracking-tight">
                        Aktuell sind keine Events geplant.
                      </div>
                    </div>
                  </div>
                ) : (
                  events.slice(0, 2).map((event) => {
                    const eventImageUrl = event.imageId ? getMediaUploadUrl(media, event.imageId) : null;

                    return (
                      <div
                        key={event.id}
                        className="flex min-h-0 overflow-hidden rounded-[1.8rem] border"
                        style={{
                          backgroundColor: withAlpha(cardBg, 0.6),
                          borderColor: withAlpha(cardBorder, 0.55),
                        }}
                      >
                        {eventImageUrl ? (
                          <div className="w-28 shrink-0 overflow-hidden">
                            <ResilientImage
                              src={eventImageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              fallback={<div className="h-full w-full bg-spa-bg-secondary" />}
                            />
                          </div>
                        ) : null}
                        <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: accentGreen }}>
                            {formatEventDateDE(event)}
                          </div>
                          <div className="mt-2 truncate text-lg font-semibold tracking-tight" style={{ color: textMain }}>
                            {event.name}
                          </div>
                          <div className="mt-2 text-sm" style={{ color: textMuted }}>
                            {formatEventTimeRangeDE(event)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </AnimatedWellnessPanel>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col justify-center relative">
      {mode === 'TIPS' ? (
        <AnimatedWellnessPanel key="tips">
            <div className="flex items-center gap-4 mb-3">
              <div
                className="p-3 rounded-xl border shadow-xs"
                style={{
                  backgroundColor: `${accentGreen}10`,
                  borderColor: `${accentGreen}20`,
                }}
              >
                <ShieldCheck className="w-6 h-6" style={{ color: accentGreen }} />
              </div>
              <h4 className="text-[12px] font-black uppercase tracking-[0.4em]" style={{ color: accentGold }}>
                {tip.title || 'Info'}
              </h4>
            </div>
            <p
              className="text-[17px] leading-relaxed font-bold uppercase tracking-tight italic pl-3 border-l-4"
              style={{
                color: textMuted,
                borderLeftColor: `${accentGreen}20`,
              }}
            >
              {tip.text}
            </p>
        </AnimatedWellnessPanel>
      ) : (
        <AnimatedWellnessPanel key="events">
            <div className="flex items-center gap-4 mb-3">
              <div
                className="p-3 rounded-xl border shadow-xs"
                style={{
                  backgroundColor: `${accentGold}10`,
                  borderColor: `${accentGold}20`,
                }}
              >
                <Calendar className="w-6 h-6" style={{ color: accentGold }} />
              </div>
              <h4 className="text-[12px] font-black uppercase tracking-[0.4em]" style={{ color: accentGold }}>
                Events
              </h4>
            </div>

            <div className="flex gap-4">
              {events.length === 0 ? (
                <div
                  className="flex-1 p-4 rounded-2xl border"
                  style={{
                    backgroundColor: withAlpha(cardBg, 0.35),
                    borderColor: withAlpha(cardBorder, 0.6),
                    color: textMain,
                  }}
                >
                  <div className="text-base font-black uppercase leading-tight mb-1">Keine Events geplant</div>
                  <div className="text-[10px] font-bold uppercase opacity-70">Demnaechst mehr</div>
                </div>
              ) : (
                events.map((event) => {
                  const eventImageUrl = event.imageId ? getMediaUploadUrl(media, event.imageId) : null;
                  return (
                    <div
                      key={event.id}
                      className="flex-1 rounded-2xl border overflow-hidden flex"
                      style={{
                        backgroundColor: withAlpha(cardBg, 0.35),
                        borderColor: withAlpha(cardBorder, 0.6),
                      }}
                    >
                      {eventImageUrl && (
                        <div className="w-20 shrink-0 overflow-hidden">
                          <ResilientImage
                            src={eventImageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            fallback={<div className="w-full h-full bg-spa-bg-secondary" />}
                          />
                        </div>
                      )}
                      <div className="p-4 min-w-0 flex-1">
                        <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: accentGreen }}>
                          {formatEventDateDE(event)}
                        </div>
                        <div className="text-base font-black uppercase leading-tight mb-1 truncate" style={{ color: textMain }}>
                          {event.name}
                        </div>
                        <div className="text-[10px] font-bold uppercase" style={{ color: withAlpha(textMain, 0.58) }}>
                          {formatEventTimeRangeDE(event)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
        </AnimatedWellnessPanel>
      )}
    </div>
  );
});
