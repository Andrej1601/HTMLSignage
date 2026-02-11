import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ShieldCheck } from 'lucide-react';
import type { Settings, ThemeColors } from '@/types/settings.types';
import { getDefaultSettings } from '@/types/settings.types';
import {
  formatEventDateDE,
  formatEventTimeRangeDE,
  getUpcomingOrActiveEvents,
  withAlpha,
} from './wellnessDisplayUtils';

const INTERVAL_MS = 8000;

interface WellnessBottomPanelProps {
  settings: Settings;
  theme?: ThemeColors;
}

export function WellnessBottomPanel({ settings, theme }: WellnessBottomPanelProps) {
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

  return (
    <div className="h-full flex flex-col justify-center relative">
      <AnimatePresence mode="wait">
        {mode === 'TIPS' ? (
          <motion.div
            key="tips"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="h-full flex flex-col justify-center"
          >
            <div className="flex items-center gap-4 mb-3">
              <div
                className="p-3 rounded-xl border shadow-sm"
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
          </motion.div>
        ) : (
          <motion.div
            key="events"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="h-full flex flex-col justify-center"
          >
            <div className="flex items-center gap-4 mb-3">
              <div
                className="p-3 rounded-xl border shadow-sm"
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
                events.map((event) => (
                  <div
                    key={event.id}
                    className="flex-1 p-4 rounded-2xl border"
                    style={{
                      backgroundColor: withAlpha(cardBg, 0.35),
                      borderColor: withAlpha(cardBorder, 0.6),
                    }}
                  >
                    <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: accentGreen }}>
                      {formatEventDateDE(event)}
                    </div>
                    <div className="text-base font-black uppercase leading-tight mb-1" style={{ color: textMain }}>
                      {event.name}
                    </div>
                    <div className="text-[10px] font-bold uppercase" style={{ color: withAlpha(textMain, 0.58) }}>
                      {formatEventTimeRangeDE(event)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
