import type { CSSProperties, ReactNode } from 'react';
import type { Settings, ThemeColors } from '@/types/settings.types';
import type { Media } from '@/types/media.types';
import { Waves } from 'lucide-react';
import { classNames } from '@/utils/classNames';
import { withAlpha } from '@/components/Display/wellnessDisplayUtils';
import { useDisplayViewportProfile } from '@/components/Display/useDisplayViewportProfile';
import { getMediaUploadUrl } from '@/utils/mediaUrl';

interface EditorialTokens {
  accentCool: string;
  accentWarm: string;
  background: string;
  border: string;
  card: string;
  textMain: string;
  textMuted: string;
}

interface DisplayEditorialStageProps {
  theme: ThemeColors;
  subtitle?: string;
  title?: string;
  meta?: string;
  /**
   * Optional resolved image URL for the header logo. When set, replaces
   * the `title` text in the masthead pill. Passing `title` alongside is
   * fine — it's used as the `alt` text.
   */
  logoImageUrl?: string;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

interface DisplayEditorialPanelProps {
  theme: ThemeColors;
  label?: string;
  meta?: string;
  tone?: 'paper' | 'glass' | 'accent';
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

function getEditorialTokens(theme: ThemeColors): EditorialTokens {
  return {
    background: theme.dashboardBg || theme.bg || '#FDFBF7',
    card: theme.cardBg || theme.cellBg || '#FFFFFF',
    border: theme.cardBorder || theme.gridTable || '#EBE5D3',
    textMain: theme.textMain || theme.fg || '#3E2723',
    textMuted: theme.textMuted || theme.fg || '#5D4037',
    accentWarm: theme.accentGold || theme.accent || '#A68A64',
    accentCool: theme.accentGreen || theme.timeColBg || '#8F9779',
  };
}

function getEditorialStageStyle(theme: ThemeColors): CSSProperties {
  const tokens = getEditorialTokens(theme);

  return {
    backgroundColor: tokens.background,
    backgroundImage: [
      `radial-gradient(circle at 0% 0%, ${withAlpha(tokens.accentWarm, 0.24)} 0%, transparent 28%)`,
      `radial-gradient(circle at 100% 0%, ${withAlpha(tokens.accentCool, 0.26)} 0%, transparent 34%)`,
      `linear-gradient(140deg, ${tokens.background} 0%, ${withAlpha(tokens.accentWarm, 0.07)} 48%, ${withAlpha(tokens.accentCool, 0.12)} 100%)`,
    ].join(', '),
  };
}

function getEditorialPanelStyle(
  theme: ThemeColors,
  tone: NonNullable<DisplayEditorialPanelProps['tone']>,
): CSSProperties {
  const tokens = getEditorialTokens(theme);

  if (tone === 'glass') {
    return {
      backgroundColor: withAlpha(tokens.card, 0.72),
      borderColor: withAlpha(tokens.accentCool, 0.32),
      boxShadow: `0 28px 58px ${withAlpha(tokens.textMain, 0.12)}`,
    };
  }

  if (tone === 'accent') {
    return {
      backgroundColor: withAlpha(tokens.card, 0.88),
      borderColor: withAlpha(tokens.accentWarm, 0.34),
      boxShadow: `0 24px 52px ${withAlpha(tokens.accentWarm, 0.18)}`,
    };
  }

  return {
    backgroundColor: withAlpha(tokens.card, 0.94),
    borderColor: withAlpha(tokens.border, 0.9),
    boxShadow: `0 24px 56px ${withAlpha(tokens.textMain, 0.1)}`,
  };
}

export function getEditorialStageMeta(
  settings: Settings,
  currentTime: Date,
  media?: Media[],
): {
  subtitle: string;
  title: string;
  meta: string;
  logoImageUrl?: string;
} {
  const header = settings.header;

  // Operator disabled the header entirely → hide the masthead. Stage
  // consumers render the banner only when at least one of
  // title/subtitle/meta is non-empty, so returning '' suppresses it.
  if (header && header.enabled === false) {
    return { subtitle: '', title: '', meta: '' };
  }

  const showLogo = header?.showLogo ?? true;
  const showClock = header?.showClock ?? true;
  const showDate = header?.showDate ?? true;

  const subtitle = showLogo ? (header?.subtitle?.trim() || 'Saunawelt') : '';
  const rawLogoText = (header?.logoText || '').trim();
  const title = !showLogo
    ? ''
    : !rawLogoText || /^html\s*signage$/i.test(rawLogoText)
      ? 'Westfalenbad Hagen'
      : rawLogoText;

  // `meta` carries both date and clock. We compose it from the pieces the
  // operator asked for and fall back to '' when both toggles are off.
  const dateParts = showDate
    ? new Intl.DateTimeFormat('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      }).format(currentTime)
    : '';
  const timeParts = showClock
    ? new Intl.DateTimeFormat('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(currentTime)
    : '';
  const meta = [dateParts, timeParts].filter(Boolean).join(' · ');

  const logoImageUrl = showLogo
    ? getMediaUploadUrl(media, header?.logoImageId) ?? undefined
    : undefined;

  return { subtitle, title, meta, logoImageUrl };
}

export function DisplayEditorialStage({
  theme,
  subtitle,
  title,
  meta,
  logoImageUrl,
  className,
  contentClassName,
  children,
}: DisplayEditorialStageProps) {
  const tokens = getEditorialTokens(theme);
  const { containerRef, profile } = useDisplayViewportProfile<HTMLDivElement>();
  const isCompact = profile.isCompact;
  const isUltraCompact = profile.isUltraCompact;

  return (
    <div
      ref={containerRef}
      className={classNames(
        'relative flex h-full w-full flex-col overflow-hidden',
        isUltraCompact ? 'p-3' : isCompact ? 'p-4' : 'p-5',
        className,
      )}
      style={getEditorialStageStyle(theme)}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-[10%] -top-[12%] h-[34%] w-[26%] rounded-full blur-3xl"
          style={{ backgroundColor: withAlpha(tokens.accentWarm, 0.22) }}
        />
        <div
          className="absolute -right-[8%] top-[6%] h-[30%] w-[22%] rounded-full blur-3xl"
          style={{ backgroundColor: withAlpha(tokens.accentCool, 0.22) }}
        />
        <div
          className="absolute bottom-[8%] left-[18%] h-[22%] w-[24%] rounded-full blur-3xl"
          style={{ backgroundColor: withAlpha(tokens.accentWarm, 0.1) }}
        />
        <div
          className={classNames(
            'absolute border',
            isUltraCompact
              ? 'inset-[1rem] rounded-[1.4rem]'
              : isCompact
                ? 'inset-[1.4rem] rounded-[1.9rem]'
                : 'inset-[2.25rem] rounded-[2.75rem]',
          )}
          style={{ borderColor: withAlpha(tokens.border, 0.28) }}
        />
      </div>

      {(subtitle || title || meta || logoImageUrl) && (
        <div
          className={classNames(
            'relative z-10 flex items-center justify-between px-1',
            isUltraCompact ? 'mb-2 gap-2' : isCompact ? 'mb-3 gap-3' : 'mb-4 gap-4 px-2',
          )}
        >
          {subtitle || title || logoImageUrl ? (
            <div
              className={classNames(
                'inline-flex max-w-[72%] items-center rounded-full border',
                isUltraCompact ? 'gap-2 px-2.5 py-1.5' : isCompact ? 'gap-2.5 px-3 py-1.5' : 'gap-3 px-3.5 py-2',
              )}
              style={{
                borderColor: withAlpha(tokens.accentWarm, 0.28),
                backgroundColor: withAlpha(tokens.card, 0.58),
              }}
            >
              {logoImageUrl ? (
                <img
                  src={logoImageUrl}
                  alt={title || 'Logo'}
                  className={classNames(
                    'shrink-0 rounded-full object-contain bg-white/70',
                    isUltraCompact ? 'h-6 w-6' : isCompact ? 'h-7 w-7' : 'h-8 w-8',
                  )}
                />
              ) : (
                <div
                  className={classNames(
                    'flex shrink-0 items-center justify-center rounded-full border',
                    isUltraCompact ? 'h-6 w-6' : isCompact ? 'h-7 w-7' : 'h-8 w-8',
                  )}
                  style={{
                    color: tokens.accentWarm,
                    borderColor: withAlpha(tokens.accentWarm, 0.22),
                    backgroundColor: withAlpha(tokens.accentWarm, 0.1),
                  }}
                >
                  <Waves className={classNames(isUltraCompact ? 'h-3 w-3' : 'h-4 w-4')} />
                </div>
              )}
              <div className={classNames('flex min-w-0 items-baseline whitespace-nowrap', isCompact ? 'gap-2' : 'gap-2.5')}>
                {subtitle ? (
                  <span
                    className={classNames(
                      'shrink-0 font-black uppercase',
                      isUltraCompact ? 'text-[8px] tracking-[0.22em]' : isCompact ? 'text-[9px] tracking-[0.24em]' : 'text-[10px] tracking-[0.3em]',
                    )}
                    style={{ color: tokens.accentWarm }}
                  >
                    {subtitle}
                  </span>
                ) : null}
                {title && !logoImageUrl ? (
                  <span
                    className={classNames(
                      'truncate font-semibold tracking-tight',
                      isUltraCompact ? 'text-[12px]' : isCompact ? 'text-[13px]' : 'text-[15px]',
                    )}
                    style={{ color: tokens.textMain }}
                  >
                    {title}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <span />
          )}
          {meta ? (
            <div
              className={classNames(
                'rounded-full border font-semibold',
                isUltraCompact ? 'px-2.5 py-1 text-[9px]' : isCompact ? 'px-3 py-1.5 text-[10px]' : 'px-4 py-2 text-[11px]',
              )}
              style={{
                color: tokens.textMuted,
                borderColor: withAlpha(tokens.accentCool, 0.24),
                backgroundColor: withAlpha(tokens.card, 0.6),
              }}
            >
              {meta}
            </div>
          ) : null}
        </div>
      )}

      <div className={classNames('relative z-10 min-h-0 flex-1', contentClassName)}>{children}</div>
    </div>
  );
}

export function DisplayEditorialPanel({
  theme,
  label,
  meta,
  tone = 'paper',
  className,
  contentClassName,
  children,
}: DisplayEditorialPanelProps) {
  const tokens = getEditorialTokens(theme);
  const labelColor = tone === 'glass' ? tokens.accentCool : tokens.accentWarm;
  const { containerRef, profile } = useDisplayViewportProfile<HTMLElement>();
  const isCompact = profile.isCompact;
  const isUltraCompact = profile.isUltraCompact;

  return (
    <section
      ref={containerRef}
      className={classNames(
        'relative flex h-full min-h-0 flex-col overflow-hidden rounded-[2.25rem] border backdrop-blur-xl',
        isUltraCompact ? 'rounded-[1.3rem]' : isCompact ? 'rounded-[1.65rem]' : 'rounded-[2.25rem]',
        className,
      )}
      style={getEditorialPanelStyle(theme, tone)}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
        style={{
          background: `linear-gradient(90deg, ${withAlpha(tokens.accentWarm, 0.92)}, ${withAlpha(tokens.accentCool, 0.88)})`,
        }}
      />

      {(label || meta) && (
        <div
          className={classNames(
            'relative z-10 flex shrink-0 items-center justify-between',
            isUltraCompact ? 'gap-2 px-3 pb-2.5 pt-3' : isCompact ? 'gap-3 px-4 pb-3 pt-3.5' : 'gap-4 px-6 pb-4 pt-5',
          )}
        >
          {label ? (
            <div
              className={classNames(
                'font-black uppercase',
                isUltraCompact ? 'text-[9px] tracking-[0.2em]' : isCompact ? 'text-[10px] tracking-[0.26em]' : 'text-[11px] tracking-[0.34em]',
              )}
              style={{ color: labelColor }}
            >
              {label}
            </div>
          ) : (
            <span />
          )}
          {meta ? (
            <div
              className={classNames(
                'font-semibold',
                isUltraCompact ? 'text-[9px]' : isCompact ? 'text-[10px]' : 'text-[11px]',
              )}
              style={{ color: withAlpha(tokens.textMuted, 0.92) }}
            >
              {meta}
            </div>
          ) : null}
        </div>
      )}

      <div className={classNames('relative z-10 min-h-0 flex-1 overflow-hidden', contentClassName)}>
        {children}
      </div>
    </section>
  );
}
