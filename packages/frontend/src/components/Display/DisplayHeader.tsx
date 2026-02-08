import { useEffect, useState } from 'react';
import type { HeaderSettings, ThemeColors } from '@/types/settings.types';

interface DisplayHeaderProps {
  settings: HeaderSettings;
  theme: ThemeColors;
}

export function DisplayHeader({ settings, theme }: DisplayHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!settings.enabled) return null;

  const formattedTime = currentTime.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedDate = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(currentTime);

  // Split logoText into words for two-tone styling
  const logoWords = settings.logoText?.split(' ') || ['HTML', 'Signage'];
  const firstWord = logoWords[0];
  const restWords = logoWords.slice(1).join(' ');

  return (
    <header
      className="flex justify-between items-center px-10 border-b"
      style={{
        height: `${settings.height || 8}%`,
        backgroundColor: theme.dashboardBg || theme.bg,
        borderColor: theme.cardBorder || theme.gridTable,
        color: theme.textMain || theme.fg,
      }}
    >
      {/* Logo/Title Section */}
      <div className="flex flex-col justify-center gap-2">
        {settings.showLogo && (
          <h1
            className="text-2xl font-black tracking-tighter uppercase leading-none"
            style={{ color: theme.textMain || theme.fg }}
          >
            {firstWord}{' '}
            {restWords && (
              <span style={{ color: theme.accentGold || theme.accent }}>
                {restWords}
              </span>
            )}
          </h1>
        )}
        {settings.subtitle && (
          <div
            className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-80"
            style={{ color: theme.accentGold || theme.accent }}
          >
            {settings.subtitle}
          </div>
        )}
        {/* Navigation Pills */}
        <div className="flex gap-2 mt-1">
          <button
            className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all"
            style={{
              backgroundColor: `${theme.accentGold || theme.accent}20`,
              borderColor: theme.accentGold || theme.accent,
              color: theme.accentGold || theme.accent,
            }}
          >
            Zeitplan
          </button>
          <button
            className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all opacity-50 hover:opacity-100"
            style={{
              backgroundColor: 'transparent',
              borderColor: `${theme.textMuted || theme.fg}40`,
              color: theme.textMuted || theme.fg,
            }}
          >
            Events
          </button>
        </div>
      </div>

      {/* Time/Date Section */}
      <div className="flex flex-col items-end justify-center">
        {settings.showClock && (
          <div
            className="text-3xl font-mono font-bold leading-none tabular-nums"
            style={{ color: theme.accentGold || theme.accent }}
          >
            {formattedTime}
          </div>
        )}
        {settings.showDate && (
          <div
            className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-70"
            style={{ color: theme.textMuted || theme.fg }}
          >
            {formattedDate}
          </div>
        )}
      </div>
    </header>
  );
}
