import { useEffect, useMemo, useState } from 'react';
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

  // 30 s reicht — wir zeigen die Uhrzeit nur als HH:MM ohne Sekunden.
  // Eine sekündlich tickende Uhr auf einem Wellness-Display ist (a) aus
  // 3–5 m Distanz unlesbar und (b) ein potenzieller Burn-in-Hotspot, weil
  // sich die letzten zwei Pixel ständig ändern.
  useEffect(() => {
    if (!settings.showClock && !settings.showDate) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [settings.showClock, settings.showDate]);

  // Burn-in-Mitigation für 24/7-Displays: alle 30 Min wandert der Header
  // um 1 px in eine zufällige Richtung. Subpixel-unauffällig im Dampf-Spa,
  // verhindert aber pixelgenau eingebrannte Logos auf OLED/QLED-Panels.
  // Nutzt `currentTime` als Tick-Quelle — neu berechnet bei jedem Tick.
  // MUSS vor dem early-return stehen (Rules-of-Hooks).
  const burnInShift = useMemo(() => {
    const slot = Math.floor(currentTime.getTime() / (30 * 60 * 1000));
    const variants: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
    ];
    return variants[slot % variants.length] ?? [0, 0];
  }, [currentTime]);

  if (!settings.enabled) return null;

  const formattedTime = currentTime.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
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
        // Burn-in-Pixel-Shift, sub-pixel unauffällig
        transform: `translate(${burnInShift[0]}px, ${burnInShift[1]}px)`,
        willChange: 'transform',
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
          // Etwas größer als zuvor (10 → 12 px) und reduziertes Tracking
          // (0.3em → 0.2em), damit die Subtitle aus Spa-Distanz lesbar
          // bleibt. Opacity 0.9 statt 0.8 für sauberen Kontrast.
          <div
            className="text-xs font-bold uppercase tracking-[0.2em] opacity-90"
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
            // 12 px statt 10 px + Opacity 0.9 statt 0.7 für besseren
            // Kontrast aus Distanz; `text-muted` statt voll-textMain ist
            // OK weil die Datumsangabe sekundär zur Uhrzeit ist.
            <div
              className="mt-1 text-xs font-black uppercase tracking-widest opacity-90"
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
