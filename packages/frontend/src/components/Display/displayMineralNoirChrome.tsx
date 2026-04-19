/**
 * Mineral Noir — Display Chrome
 *
 * Design-Prinzip: architektonischer Dark-Luxus.
 * Scharfe Kanten, kein Blur, kein Glow — Betonplatten-Ästhetik.
 * Vertikaler Akzentstreifen statt horizontaler Linie.
 * Geometrisches Gitter-Overlay im Stage-Hintergrund.
 *
 * Struktur:
 *   MineralNoirStage  — äußerer Container mit geometrischem Hintergrund + Header
 *   MineralNoirPanel  — scharfkantiges Panel mit linkem Akzentstreifen
 */
import type { CSSProperties, ReactNode } from 'react';
import type { Settings, ThemeColors } from '@/types/settings.types';
import type { Media } from '@/types/media.types';
import { classNames } from '@/utils/classNames';
import { withAlpha } from '@/components/Display/wellnessDisplayUtils';
import { useDisplayViewportProfile } from '@/components/Display/useDisplayViewportProfile';
import { getMediaUploadUrl } from '@/utils/mediaUrl';

// ── Token extractor ───────────────────────────────────────────────────────────

interface MineralTokens {
  bg: string;
  card: string;
  border: string;
  textMain: string;
  textMuted: string;
  platinum: string;
  emerald: string;
}

export function getMineralTokens(theme: ThemeColors): MineralTokens {
  return {
    bg:        theme.dashboardBg  || theme.bg        || '#0D0F14',
    card:      theme.cardBg       || theme.cellBg     || '#141820',
    border:    theme.cardBorder   || theme.gridTable  || '#22262E',
    textMain:  theme.textMain     || theme.fg         || '#ECEAE6',
    textMuted: theme.textMuted    || '#6B7280',
    platinum:  theme.accentGold   || theme.accent     || '#A09880',
    emerald:   theme.accentGreen  || theme.statusLive || '#3DD9AC',
  };
}

// ── Stage ─────────────────────────────────────────────────────────────────────

export interface MineralNoirStageProps {
  theme: ThemeColors;
  title?: string;
  subtitle?: string;
  meta?: string;
  /**
   * Optional resolved image URL for the header logo. When set, replaces
   * the `title` text in the masthead. `title` is still used as alt text
   * if present.
   */
  logoImageUrl?: string;
  className?: string;
  children: ReactNode;
}

export function getMineralNoirStageMeta(
  settings: Settings,
  currentTime: Date,
  media?: Media[],
): { title: string; subtitle: string; meta: string; logoImageUrl?: string } {
  const header = settings.header;

  if (header && header.enabled === false) {
    return { title: '', subtitle: '', meta: '' };
  }

  const showLogo = header?.showLogo ?? true;
  const showClock = header?.showClock ?? true;
  const showDate = header?.showDate ?? true;

  const subtitle = showLogo
    ? (header?.subtitle?.trim() || 'Saunawelt').toUpperCase()
    : '';
  const rawLogoText = (header?.logoText || '').trim();
  const title = !showLogo
    ? ''
    : !rawLogoText || /^html\s*signage$/i.test(rawLogoText)
      ? 'Westfalenbad Hagen'
      : rawLogoText;

  const datePart = showDate
    ? new Intl.DateTimeFormat('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      }).format(currentTime)
    : '';
  const timePart = showClock
    ? new Intl.DateTimeFormat('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(currentTime)
    : '';
  const meta = [datePart, timePart].filter(Boolean).join(' · ').toUpperCase();

  const logoImageUrl = showLogo
    ? getMediaUploadUrl(media, header?.logoImageId) ?? undefined
    : undefined;

  return { title, subtitle, meta, logoImageUrl };
}

export function MineralNoirStage({
  theme,
  title,
  subtitle,
  meta,
  logoImageUrl,
  className,
  children,
}: MineralNoirStageProps) {
  const t = getMineralTokens(theme);
  const { containerRef, profile } = useDisplayViewportProfile<HTMLDivElement>();
  const isCompact = profile.isCompact;
  const isUltraCompact = profile.isUltraCompact;

  const pad = isUltraCompact ? 'p-2.5' : isCompact ? 'p-3.5' : 'p-5';
  const headerPy = isUltraCompact ? 'py-2' : isCompact ? 'py-2.5' : 'py-3.5';

  // Eckmarkierungen statt rundem Innenrahmen
  const cornerSize = isUltraCompact ? 12 : isCompact ? 16 : 22;
  const cornerInset = isUltraCompact ? 10 : isCompact ? 14 : 20;
  const cornerStyle = (pos: 'tl' | 'tr' | 'bl' | 'br'): CSSProperties => ({
    position: 'absolute',
    width: cornerSize,
    height: cornerSize,
    [pos.includes('t') ? 'top' : 'bottom']: cornerInset,
    [pos.includes('l') ? 'left' : 'right']: cornerInset,
    borderTop: pos.includes('t') ? `1px solid ${withAlpha(t.emerald, 0.55)}` : undefined,
    borderBottom: pos.includes('b') ? `1px solid ${withAlpha(t.emerald, 0.55)}` : undefined,
    borderLeft: pos.includes('l') ? `1px solid ${withAlpha(t.emerald, 0.55)}` : undefined,
    borderRight: pos.includes('r') ? `1px solid ${withAlpha(t.emerald, 0.55)}` : undefined,
    pointerEvents: 'none',
  });

  return (
    <div
      ref={containerRef}
      className={classNames('relative flex h-full w-full flex-col overflow-hidden', pad, className)}
      style={{ backgroundColor: t.bg, color: t.textMain }}
    >
      {/* Vier Eck-Markierungen statt Innenrahmen */}
      <div style={cornerStyle('tl')} />
      <div style={cornerStyle('tr')} />
      <div style={cornerStyle('bl')} />
      <div style={cornerStyle('br')} />

      {/* Header bar */}
      {(title || subtitle || meta || logoImageUrl) && (
        <div
          className={classNames(
            'relative z-10 flex shrink-0 items-center justify-between',
            headerPy,
            isUltraCompact ? 'px-3 mb-2' : isCompact ? 'px-4 mb-2.5' : 'px-5 mb-4',
          )}
        >
          {/* Links: Eyebrow + Titel mit Smaragd-Akzentlinie */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Vertikale Akzentlinie */}
            <div
              className="shrink-0 self-stretch"
              style={{
                width: isUltraCompact ? '2px' : '3px',
                backgroundColor: t.emerald,
                borderRadius: '1px',
              }}
            />
            {logoImageUrl ? (
              <img
                src={logoImageUrl}
                alt={title || 'Logo'}
                className={classNames(
                  'shrink-0 object-contain',
                  isUltraCompact ? 'h-7 max-w-[6rem]' : isCompact ? 'h-9 max-w-[8rem]' : 'h-11 max-w-[10rem]',
                )}
              />
            ) : null}
            <div className="flex flex-col gap-0.5 min-w-0">
              {subtitle && (
                <span
                  className={classNames(
                    'font-bold uppercase tracking-[0.35em]',
                    isUltraCompact ? 'text-[8px]' : isCompact ? 'text-[9px]' : 'text-[10px]',
                  )}
                  style={{ color: t.emerald }}
                >
                  {subtitle}
                </span>
              )}
              {title && !logoImageUrl && (
                <span
                  className={classNames(
                    'font-semibold tracking-tight truncate',
                    isUltraCompact ? 'text-[13px]' : isCompact ? 'text-[15px]' : 'text-[19px]',
                  )}
                  style={{ color: t.textMain }}
                >
                  {title}
                </span>
              )}
            </div>
          </div>

          {/* Rechts: Datum/Uhrzeit — monospace, platin, in eckiger Box */}
          {meta && (
            <div
              className={classNames(
                'font-mono font-medium tabular-nums shrink-0 border',
                isUltraCompact ? 'text-[9px] px-2 py-1' : isCompact ? 'text-[10px] px-2.5 py-1.5' : 'text-[12px] px-3 py-2',
              )}
              style={{
                color: t.platinum,
                borderColor: withAlpha(t.border, 0.8),
                backgroundColor: withAlpha(t.card, 0.6),
                borderRadius: 0,
              }}
            >
              {meta}
            </div>
          )}
        </div>
      )}

      {/* Hairline-Trennlinie mit Smaragd-Akzent */}
      {(title || subtitle || meta || logoImageUrl) && (
        <div className="relative z-10 shrink-0 mb-3 flex items-center gap-2">
          <div
            className="shrink-0"
            style={{
              width: isUltraCompact ? '16px' : isCompact ? '24px' : '32px',
              height: '1px',
              backgroundColor: t.emerald,
            }}
          />
          <div
            className="flex-1"
            style={{ height: '1px', backgroundColor: withAlpha(t.border, 0.7) }}
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 min-h-0 flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export interface MineralNoirPanelProps {
  theme: ThemeColors;
  label?: string;
  meta?: string;
  accentTone?: 'emerald' | 'platinum' | 'none';
  /** Wenn true: kein Padding, Inhalt blutet bis zur Kante (für Bilder/Media) */
  fullBleed?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

export function MineralNoirPanel({
  theme,
  label,
  meta,
  accentTone = 'emerald',
  fullBleed = false,
  className,
  contentClassName,
  children,
}: MineralNoirPanelProps) {
  const t = getMineralTokens(theme);
  const { containerRef, profile } = useDisplayViewportProfile<HTMLElement>();
  const isCompact = profile.isCompact;
  const isUltraCompact = profile.isUltraCompact;

  const accentColor =
    accentTone === 'emerald'  ? t.emerald  :
    accentTone === 'platinum' ? t.platinum :
    withAlpha(t.border, 0.4);

  const stripeWidth = isUltraCompact ? '2px' : isCompact ? '3px' : '3px';

  const panelStyle: CSSProperties = {
    backgroundColor: t.card,
    border: `1px solid ${t.border}`,
    // Scharfe Ecken — kein border-radius. Definierendes Merkmal von Mineral Noir.
    borderRadius: 0,
    overflow: 'hidden',
    position: 'relative',
  };

  return (
    <section
      ref={containerRef}
      className={classNames('relative flex h-full min-h-0 flex-col', className)}
      style={panelStyle}
    >
      {/* Linker vertikaler Akzentstreifen — statt horizontaler Linie wie bei Editorial */}
      <div
        className="absolute left-0 top-0 bottom-0 z-10 shrink-0 pointer-events-none"
        style={{ width: stripeWidth, backgroundColor: accentColor }}
      />

      {/* Panel header */}
      {(label || meta) && (
        <div
          className={classNames(
            'flex shrink-0 items-center justify-between',
            isUltraCompact ? 'pl-4 pr-3 py-2' : isCompact ? 'pl-5 pr-4 py-2.5' : 'pl-6 pr-5 py-3',
          )}
          style={{ borderBottom: `1px solid ${withAlpha(t.border, 0.7)}` }}
        >
          {label ? (
            <span
              className={classNames(
                'font-bold uppercase tracking-[0.3em]',
                isUltraCompact ? 'text-[8px]' : isCompact ? 'text-[9px]' : 'text-[10px]',
              )}
              style={{ color: t.platinum }}
            >
              {label}
            </span>
          ) : <span />}
          {meta ? (
            <span
              className={classNames(
                'font-mono tabular-nums',
                isUltraCompact ? 'text-[9px]' : isCompact ? 'text-[10px]' : 'text-[11px]',
              )}
              style={{ color: withAlpha(t.textMuted, 0.9) }}
            >
              {meta}
            </span>
          ) : null}
        </div>
      )}

      {/* Content — mit linkem Padding-Offset für den Stripe, außer bei fullBleed */}
      <div
        className={classNames('min-h-0 flex-1 overflow-hidden', contentClassName)}
        style={!fullBleed ? { paddingLeft: stripeWidth } : undefined}
      >
        {children}
      </div>
    </section>
  );
}
