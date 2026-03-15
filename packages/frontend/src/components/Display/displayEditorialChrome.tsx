import type { CSSProperties, ReactNode } from 'react';
import type { Settings, ThemeColors } from '@/types/settings.types';
import { Waves } from 'lucide-react';
import { classNames } from '@/utils/classNames';
import { withAlpha } from '@/components/Display/wellnessDisplayUtils';

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

export function getEditorialStageMeta(settings: Settings, currentTime: Date): {
  subtitle: string;
  title: string;
  meta: string;
} {
  const subtitle = settings.header?.subtitle?.trim() || 'Saunawelt';
  const rawLogoText = (settings.header?.logoText || '').trim();
  const title =
    !rawLogoText || /^html\s*signage$/i.test(rawLogoText)
      ? 'Westfalenbad Hagen'
      : rawLogoText;
  const meta = new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(currentTime);

  return { subtitle, title, meta };
}

export function DisplayEditorialStage({
  theme,
  subtitle,
  title,
  meta,
  className,
  contentClassName,
  children,
}: DisplayEditorialStageProps) {
  const tokens = getEditorialTokens(theme);

  return (
    <div
      className={classNames('relative h-full w-full overflow-hidden p-5', className)}
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
          className="absolute inset-[2.25rem] rounded-[2.75rem] border"
          style={{ borderColor: withAlpha(tokens.border, 0.28) }}
        />
      </div>

      {(subtitle || title || meta) && (
        <div className="relative z-10 mb-4 flex items-center justify-between gap-4 px-2">
          {subtitle || title ? (
            <div
              className="inline-flex max-w-[70%] items-center gap-3 rounded-full border px-3.5 py-2"
              style={{
                borderColor: withAlpha(tokens.accentWarm, 0.28),
                backgroundColor: withAlpha(tokens.card, 0.58),
              }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                style={{
                  color: tokens.accentWarm,
                  borderColor: withAlpha(tokens.accentWarm, 0.22),
                  backgroundColor: withAlpha(tokens.accentWarm, 0.1),
                }}
              >
                <Waves className="h-4 w-4" />
              </div>
              <div className="flex min-w-0 items-baseline gap-2.5 whitespace-nowrap">
                {subtitle ? (
                  <span
                    className="shrink-0 text-[10px] font-black uppercase tracking-[0.3em]"
                    style={{ color: tokens.accentWarm }}
                  >
                    {subtitle}
                  </span>
                ) : null}
                {title ? (
                  <span
                    className="truncate text-[15px] font-semibold tracking-tight"
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
              className="rounded-full border px-4 py-2 text-[11px] font-semibold"
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

      <div className={classNames('relative z-10 h-full', contentClassName)}>{children}</div>
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

  return (
    <section
      className={classNames(
        'relative flex h-full min-h-0 flex-col overflow-hidden rounded-[2.25rem] border backdrop-blur-xl',
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
        <div className="relative z-10 flex shrink-0 items-center justify-between gap-4 px-6 pb-4 pt-5">
          {label ? (
            <div
              className="text-[11px] font-black uppercase tracking-[0.34em]"
              style={{ color: labelColor }}
            >
              {label}
            </div>
          ) : (
            <span />
          )}
          {meta ? (
            <div
              className="text-[11px] font-semibold"
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
