/**
 * StatusBadge — kleines „LÄUFT/GLEICH/NÄCHSTER"-Pill für die Display-
 * Anzeige. Vorher als hellem Pastell auf hellem Hintergrund mit
 * Alpha-25 % gerendert, was im Kontrast unter 3:1 fiel (WCAG 1.4.11).
 *
 * Jetzt: solider Hintergrund in der Statusfarbe, Textfarbe wird über
 * `pickReadableText` automatisch auf weiß oder dunkel gewechselt — so
 * bleibt der Badge in jeder Themepalette gut lesbar aus Distanz.
 */
import type { ThemeColors } from '@/types/settings.types';
import clsx from 'clsx';

interface StatusBadgeProps {
  status: 'ongoing' | 'prestart' | 'next' | null;
  theme: ThemeColors;
  size?: 'sm' | 'md';
}

/** Liefert eine Textfarbe (#000 oder #fff), die gegen `bgHex` mindestens
 *  4.5:1 Kontrast hat. ITU-BT.709-Luma als coarse heuristic — reicht für
 *  Statusfarben, die durchweg gesättigt sind. */
function pickReadableText(bgHex: string | undefined): string {
  if (!bgHex || !bgHex.startsWith('#')) return '#FFFFFF';
  const raw = bgHex.slice(1);
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (full.length !== 6) return '#FFFFFF';
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 140 ? '#1B1410' : '#FFFFFF';
}

export function StatusBadge({ status, theme, size = 'md' }: StatusBadgeProps) {
  if (!status) return null;

  const isSm = size === 'sm';
  const baseClass = clsx(
    'inline-block font-black uppercase tracking-wider rounded',
    isSm ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-1',
  );

  if (status === 'ongoing') {
    const bg = theme.statusLive || '#10B981';
    return (
      <span
        className={clsx(baseClass, 'motion-safe:animate-pulse')}
        style={{ backgroundColor: bg, color: pickReadableText(bg) }}
      >
        LÄUFT
      </span>
    );
  }

  if (status === 'prestart') {
    const bg = theme.statusPrestart || '#F59E0B';
    return (
      <span className={baseClass} style={{ backgroundColor: bg, color: pickReadableText(bg) }}>
        GLEICH
      </span>
    );
  }

  if (status === 'next') {
    const bg = theme.statusNext || theme.accentGold;
    return (
      <span className={baseClass} style={{ backgroundColor: bg, color: pickReadableText(bg) }}>
        NÄCHSTER
      </span>
    );
  }

  return null;
}
