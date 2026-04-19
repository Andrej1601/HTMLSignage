import { useEffect, useState } from 'react';
import type { HeaderSettings, ThemeColors } from '@/types/settings.types';

interface DisplayHeaderProps {
  settings: HeaderSettings;
  theme: ThemeColors;
  /**
   * Resolved URL for `settings.logoImageId`. When provided, the header
   * renders this image in place of the two-tone text logo. The URL
   * resolution happens at the host level (where `media` is available),
   * which keeps this component free of data-layer concerns.
   */
  logoImageUrl?: string;
}

export function DisplayHeader({ settings, theme, logoImageUrl }: DisplayHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Tick only as fine-grained as the UI actually needs. When the clock
  // is visible we show seconds, so a 1s interval is appropriate; when
  // the clock is hidden but the date is shown, 60s is plenty; when
  // nothing time-related is shown, we don't start the interval at all.
  useEffect(() => {
    if (!settings.showClock && !settings.showDate) return;
    const intervalMs = settings.showClock ? 1000 : 60_000;
    const timer = setInterval(() => setCurrentTime(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [settings.showClock, settings.showDate]);

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

  // Split logoText into words for two-tone styling.
  const rawLogoText = (settings.logoText || '').trim();
  const logoWords = rawLogoText ? rawLogoText.split(/\s+/) : ['HTML', 'Signage'];
  const firstWord = logoWords[0];
  const restWords = logoWords.slice(1).join(' ');

  // Height is a percentage of screen height (5–15). Clamp defensively so
  // a malformed setting can never push the content area to 0 or explode.
  const heightPercent = Math.min(15, Math.max(5, settings.height ?? 8));

  return (
    <header
      className="flex shrink-0 items-center justify-between border-b px-10"
      style={{
        height: `${heightPercent}%`,
        backgroundColor: theme.dashboardBg || theme.bg,
        borderColor: theme.cardBorder || theme.gridTable,
        color: theme.textMain || theme.fg,
      }}
    >
      {/* Logo/Title Section */}
      <div className="flex min-w-0 flex-col justify-center gap-1">
        {settings.showLogo && (
          logoImageUrl ? (
            <img
              src={logoImageUrl}
              alt={settings.logoText || 'Logo'}
              className="h-[60%] max-h-16 w-auto object-contain"
              style={{ minHeight: '2rem' }}
            />
          ) : (
            <h1
              className="truncate text-2xl font-black uppercase leading-none tracking-tighter"
              style={{ color: theme.textMain || theme.fg }}
            >
              {firstWord}
              {restWords ? ' ' : ''}
              {restWords && (
                <span style={{ color: theme.accentGold || theme.accent }}>
                  {restWords}
                </span>
              )}
            </h1>
          )
        )}
        {settings.subtitle && (
          <div
            className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-80"
            style={{ color: theme.accentGold || theme.accent }}
          >
            {settings.subtitle}
          </div>
        )}
      </div>

      {/* Time/Date Section */}
      {(settings.showClock || settings.showDate) && (
        <div className="flex shrink-0 flex-col items-end justify-center">
          {settings.showClock && (
            <div
              className="font-mono text-3xl font-bold leading-none tabular-nums"
              style={{ color: theme.accentGold || theme.accent }}
            >
              {formattedTime}
            </div>
          )}
          {settings.showDate && (
            <div
              className="mt-1 text-[10px] font-black uppercase tracking-widest opacity-70"
              style={{ color: theme.textMuted || theme.fg }}
            >
              {formattedDate}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
