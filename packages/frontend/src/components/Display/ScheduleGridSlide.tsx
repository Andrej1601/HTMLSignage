import { useEffect, useMemo, useState } from 'react';
import type { Schedule, PresetKey } from '@/types/schedule.types';
import { resolveLivePresetKey } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { getDefaultSettings } from '@/types/settings.types';
import { isEditorialDisplayAppearance } from '@/config/displayDesignStyles';
import { getVisibleSaunas } from '@/types/sauna.types';
import { AlertTriangle, Thermometer, Waves, Flame } from 'lucide-react';
import { AutoScrollingList, type InfusionListItem } from './AutoScrollingList';
import { clampFlamesTo4, formatClockDE, formatLongDateDE, resolvePrestartMinutes, withAlpha } from './wellnessDisplayUtils';
import { motion } from 'framer-motion';
import { classNames } from '@/utils/classNames';
import {
  buildScheduleSaunaIndexMap,
  getSaunaAccentColor,
  resolveScheduleSaunaIndex,
  timeToMinutes,
} from './displayScheduleUtils';
import { useDisplayViewportProfile } from '@/components/Display/useDisplayViewportProfile';

interface ScheduleGridSlideProps {
  schedule: Schedule;
  settings: Settings;
  now?: Date;
  deviceId?: string;
}

interface SaunaInfusionItem extends InfusionListItem {
  title: string;
  intensity: number; // 1-4
}

function IntensityFlames({
  level,
  size = 10,
  muted = false,
  activeColor,
}: {
  level: number;
  size?: number;
  muted?: boolean;
  activeColor: string;
}) {
  const color = muted ? 'rgba(120, 113, 108, 0.55)' : activeColor;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4].map((i) => (
        <Flame
          key={i}
          size={size}
          className={i <= level ? 'fill-current' : ''}
          style={{
            color: i <= level ? color : muted ? 'rgba(120, 113, 108, 0.25)' : 'rgba(120, 113, 108, 0.35)', // stone-ish
          }}
        />
      ))}
    </div>
  );
}

function InfusionItemGrid({
  infusion,
  status,
  textMain,
  borderColor,
  accentGold,
  statusLive,
  statusPrestart,
  compact = false,
  ultraCompact = false,
}: {
  infusion: SaunaInfusionItem;
  status: 'ONGOING' | 'PRESTART' | 'UPCOMING' | 'FINISHED';
  textMain: string;
  borderColor: string;
  accentGold: string;
  statusLive: string;
  statusPrestart: string;
  compact?: boolean;
  ultraCompact?: boolean;
}) {
  const isOngoing = status === 'ONGOING';
  const isPrestart = status === 'PRESTART';
  const isUpcoming = status === 'UPCOMING';
  const isFinished = status === 'FINISHED';

  const containerBg = isOngoing
    ? withAlpha(statusLive, 0.12)
    : isPrestart
      ? withAlpha(statusPrestart, 0.12)
      : isUpcoming
        ? withAlpha('#FFFFFF', 0.45)
        : withAlpha('#FFFFFF', 0.25);

  const containerBorder = isOngoing
    ? withAlpha(statusLive, 0.45)
    : isPrestart
      ? withAlpha(statusPrestart, 0.45)
      : withAlpha(borderColor, 0.7);

  const timeColor = isOngoing
    ? statusLive
    : isPrestart
      ? statusPrestart
      : isFinished
        ? withAlpha(textMain, 0.35)
        : withAlpha(textMain, 0.7);

  const titleColor = isFinished ? withAlpha(textMain, 0.55) : textMain;
  const durationBg = withAlpha(borderColor, 0.25);
  const durationFg = withAlpha(textMain, 0.35);
  const timeClassName = ultraCompact ? 'text-[14px]' : compact ? 'text-[16px]' : 'text-[18px]';
  const titleClassName = ultraCompact ? 'text-[10px]' : compact ? 'text-[11px]' : 'text-[12px]';
  const badgeClassName = ultraCompact ? 'text-[8px]' : 'text-[9px]';
  const paddingClassName = ultraCompact ? 'p-2.5 rounded-lg mb-2' : compact ? 'p-3 rounded-xl mb-2.5' : 'p-3.5 rounded-xl mb-3';

  return (
    <div
      className={classNames(
        'relative border transition-all duration-500 shadow-xs',
        paddingClassName,
        isFinished && 'opacity-70',
      )}
      style={{
        backgroundColor: containerBg,
        borderColor: containerBorder,
      }}
    >
      <div className="flex justify-between items-center mb-0.5">
        <div className="flex items-center gap-2">
          <span
            className={classNames('font-black tracking-tight', timeClassName)}
            style={{ color: timeColor }}
          >
            {infusion.time}
          </span>
          {isOngoing && (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className={classNames('font-black tracking-wider px-2 py-0.5 rounded border', ultraCompact ? 'text-[8px]' : 'text-[10px]')}
              style={{
                color: statusLive,
                backgroundColor: withAlpha(statusLive, 0.18),
                borderColor: withAlpha(statusLive, 0.28),
              }}
            >
              LÄUFT
            </motion.span>
          )}
          {isPrestart && (
            <span className={classNames('font-black uppercase tracking-tighter', badgeClassName)} style={{ color: statusPrestart }}>
              GLEICH
            </span>
          )}
          {isFinished && (
            <span className={classNames('font-black uppercase tracking-widest', badgeClassName)} style={{ color: withAlpha(textMain, 0.35) }}>
              VORBEI
            </span>
          )}
        </div>
        <IntensityFlames
          level={infusion.intensity}
          activeColor={isOngoing ? statusLive : accentGold}
          muted={isFinished}
        />
      </div>
      <div className="flex justify-between items-end">
        <h4
          className={classNames('font-bold uppercase tracking-wide truncate pr-2', titleClassName)}
          style={{ color: titleColor }}
        >
          {infusion.title}
        </h4>
        <span
          className={classNames('font-bold px-1.5 py-0.5 rounded', badgeClassName)}
          style={{ color: durationFg, backgroundColor: durationBg }}
        >
          {infusion.duration} MIN
        </span>
      </div>
    </div>
  );
}

export function ScheduleGridSlide({ schedule, settings, now: nowProp, deviceId }: ScheduleGridSlideProps) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;
  const header = settings.header || defaults.header!;

  const [clockNow, setClockNow] = useState(() => nowProp ?? new Date());
  const { containerRef, profile } = useDisplayViewportProfile<HTMLDivElement>();

  useEffect(() => {
    if (nowProp) return undefined;
    // Minute-level clock + status changes don't need 1s resolution.
    const t = setInterval(() => setClockNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, [nowProp]);

  const now = nowProp ?? clockNow;

  const activePresetKey: PresetKey = resolveLivePresetKey(schedule, settings, now, deviceId);

  const daySchedule = schedule.presets?.[activePresetKey];

  const scheduleSaunaIndexByKey = useMemo(
    () => buildScheduleSaunaIndexMap(daySchedule?.saunas || []),
    [daySchedule?.saunas]
  );

  const visibleSaunas = useMemo(() => getVisibleSaunas(settings.saunas || []), [settings.saunas]);
  const gridSaunas = useMemo(() => visibleSaunas.slice(0, 6), [visibleSaunas]);
  const gridColumns = profile.width > 0
    ? profile.width < 430
      ? 1
      : profile.width < 700
        ? 2
        : 3
    : 3;
  const isCompactLayout = profile.isCompact || profile.isNarrow;
  const isUltraCompactLayout = profile.isUltraCompact || profile.isShort;

  // Compute dynamic row heights based on infusion counts per row
  const gridRowTemplate = useMemo(() => {
    if (!daySchedule) return '1fr';
    if (gridColumns !== 3 || isCompactLayout) {
      return `repeat(${Math.max(1, Math.ceil(gridSaunas.length / gridColumns))}, minmax(0, 1fr))`;
    }
    if (gridSaunas.length <= 3) return '1fr 1fr';
    const countInfusions = (sauna: typeof gridSaunas[0]) => {
      const sIdx = resolveScheduleSaunaIndex(
        daySchedule.saunas, sauna.name, scheduleSaunaIndexByKey,
      );
      if (sIdx < 0) return 0;
      return daySchedule.rows.filter((row) => {
        const entry = row.entries?.[sIdx];
        return entry?.title;
      }).length;
    };
    const row1Saunas = gridSaunas.slice(0, 3);
    const row2Saunas = gridSaunas.slice(3, 6);
    const maxRow1 = Math.max(...row1Saunas.map(countInfusions), 1);
    const maxRow2 = row2Saunas.length > 0 ? Math.max(...row2Saunas.map(countInfusions), 1) : 1;
    const total = maxRow1 + maxRow2;
    const ratio = total > 0 ? maxRow1 / total : 0.5;
    if (ratio >= 0.4 && ratio <= 0.6) return '1fr 1fr';
    return `${ratio}fr ${1 - ratio}fr`;
  }, [daySchedule, gridColumns, gridSaunas, isCompactLayout, scheduleSaunaIndexByKey]);

  const accentGold = theme.accentGold || theme.accent || '#A68A64';
  const accentGreen = theme.accentGreen || theme.timeColBg || '#8F9779';
  const statusLive = theme.statusLive || '#10B981';
  const statusPrestart = theme.statusPrestart || '#F59E0B';
  const prestartMinutes = resolvePrestartMinutes(settings);
  const bgBase = theme.dashboardBg || theme.bg || '#FDFBF7';
  const leftBg = theme.zebra1 || '#F7F3E9';
  const border = theme.gridTable || '#EBE5D3';
  const textMain = theme.textMain || theme.fg || '#3E2723';
  const isEditorial = isEditorialDisplayAppearance(settings.displayAppearance);

  if (!daySchedule || !daySchedule.rows || daySchedule.rows.length === 0) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: bgBase, color: textMain }}
      >
        <div className="text-center max-w-2xl px-8">
          <div className="text-[10px] font-black uppercase tracking-[0.4em] opacity-70 mb-2" style={{ color: accentGreen }}>
            Aufgussplan
          </div>
          <div className="text-3xl font-black uppercase tracking-tighter leading-none mb-4">
            Noch keine Aufgüsse geplant
          </div>
          <div className="text-sm font-bold uppercase tracking-widest opacity-70">
            Bitte Schedule im Admin-Interface pflegen
          </div>
        </div>
      </div>
    );
  }

  const rawLogoText = (header.logoText || '').trim();
  const logoText = (!rawLogoText || /^html\s*signage$/i.test(rawLogoText))
    ? 'Westfalenbad Hagen'
    : rawLogoText;

  const titleWords = logoText.split(' ');
  const firstWord = titleWords[0] || 'Westfalenbad';
  const restWords = titleWords.slice(1).join(' ') || 'Hagen';
  const compactHeader = !isEditorial && (profile.isNarrow || profile.isPortrait);

  return (
    <div
      ref={containerRef}
      className={classNames(
        'w-full h-full flex font-sans select-none overflow-hidden',
        isEditorial
          ? isCompactLayout ? 'p-3.5' : 'p-5'
          : isCompactLayout ? 'p-4' : 'p-8',
      )}
      style={{ backgroundColor: leftBg, color: textMain }}
    >
      <div className="w-full h-full flex flex-col overflow-hidden">
        {!isEditorial && (
          <header className={classNames('z-20 w-full', compactHeader ? 'mb-4 flex flex-col gap-3' : 'mb-6 flex items-center justify-between')}>
            <div className={classNames('flex min-w-0 flex-1 items-center', isCompactLayout ? 'gap-3' : 'gap-5')}>
              <div
                className={classNames(
                  'bg-white border rounded-2xl flex items-center justify-center shadow-md shrink-0',
                  isCompactLayout ? 'h-12 w-12' : 'h-16 w-16',
                )}
                style={{ borderColor: border }}
              >
                <Waves className={classNames(isCompactLayout ? 'h-6 w-6' : 'h-8 w-8')} style={{ color: accentGreen }} />
              </div>
              <div className="min-w-0">
                <p
                  className={classNames(
                    'font-black uppercase opacity-90',
                    isUltraCompactLayout ? 'mb-0.5 text-[8px] tracking-[0.22em]' : isCompactLayout ? 'mb-0.5 text-[9px] tracking-[0.28em]' : 'mb-1 text-[10px] tracking-[0.4em]',
                  )}
                  style={{ color: accentGreen }}
                >
                  {header.subtitle && header.subtitle.trim() !== '' ? header.subtitle : 'Saunawelt'}
                </p>
                <h1
                  className={classNames(
                    'font-black uppercase tracking-tighter leading-none overflow-hidden text-ellipsis',
                    isUltraCompactLayout ? 'text-[22px] whitespace-normal' : isCompactLayout ? 'text-[28px]' : 'text-3xl whitespace-nowrap',
                  )}
                >
                  {firstWord}{' '}
                  <span style={{ color: accentGold }}>
                    {restWords}
                  </span>
                </h1>
              </div>
            </div>

            <div
              className={classNames(
                'bg-white/80 backdrop-blur-md border text-right shadow-xs shrink-0',
                compactHeader ? 'self-stretch rounded-2xl px-4 py-2.5' : isCompactLayout ? 'ml-3 rounded-2xl px-5 py-3' : 'ml-4 rounded-3xl px-7 py-4',
              )}
              style={{ borderColor: border }}
            >
              <p
                className={classNames(
                  'font-black uppercase mb-0.5',
                  isCompactLayout ? 'text-[9px] tracking-[0.18em]' : 'text-[11px] tracking-widest',
                )}
                style={{ color: accentGold }}
              >
                {formatLongDateDE(now)}
              </p>
              <p
                className={classNames(
                  'font-black font-mono leading-none',
                  isUltraCompactLayout ? 'text-[28px]' : isCompactLayout ? 'text-[34px]' : 'text-4xl',
                )}
                style={{ color: textMain }}
              >
                {formatClockDE(now)}
              </p>
            </div>
          </header>
        )}

        <div
          className={classNames(
            'grid flex-1 overflow-hidden',
            isEditorial
              ? isCompactLayout ? 'gap-x-3 gap-y-3' : 'gap-x-6 gap-y-4'
              : isCompactLayout ? 'gap-x-3 gap-y-3' : 'gap-x-8 gap-y-6 px-2',
          )}
          style={{
            gridTemplateRows: gridRowTemplate,
            gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
          }}
        >
          {gridSaunas.map((sauna, idx) => {
            const isOutOfOrder = sauna.status === 'out-of-order';
            const saunaIndex = resolveScheduleSaunaIndex(
              daySchedule.saunas,
              sauna.name,
              scheduleSaunaIndexByKey,
            );

            const infusions: SaunaInfusionItem[] = daySchedule.rows
              .map((row) => {
                const entry = saunaIndex >= 0 ? row.entries?.[saunaIndex] : null;
                if (!entry?.title) return null;
                return {
                  id: `${activePresetKey}-${sauna.id}-${row.time}`,
                  time: row.time,
                  duration: entry.duration ?? 15,
                  title: entry.title,
                  intensity: clampFlamesTo4(entry.flames ?? 1),
                };
              })
              .filter(Boolean) as SaunaInfusionItem[];
            const sortedInfusions = infusions.slice().sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

            const saunaAccent = getSaunaAccentColor(sauna, idx, accentGreen, accentGold);

            return (
              <div key={sauna.id} className="flex flex-col h-full group relative overflow-hidden">
                <div
                  className={`flex items-center justify-between border-b-2 z-20 relative ${
                    isOutOfOrder ? 'border-red-100' : ''
                  } ${isCompactLayout ? 'mb-2.5 pb-1.5' : 'mb-4 pb-2'}`}
                  style={{ borderColor: isOutOfOrder ? undefined : border }}
                >
                  <div className={classNames('flex items-center min-w-0', isCompactLayout ? 'gap-2' : 'gap-3')}>
                    <div
                      className={classNames('rounded-full shrink-0', isCompactLayout ? 'h-5 w-1.5' : 'h-7 w-2')}
                      style={{
                        background: isOutOfOrder
                          ? 'linear-gradient(to bottom, #d6d3d1, #a8a29e)'
                          : `linear-gradient(to bottom, ${saunaAccent}, ${saunaAccent})`,
                      }}
                    />
                    <h2
                      className={classNames(
                        'font-black uppercase leading-none truncate',
                        isUltraCompactLayout ? 'text-[12px] tracking-[0.12em]' : isCompactLayout ? 'text-[14px] tracking-[0.18em]' : 'text-[18px] tracking-widest',
                        isOutOfOrder ? 'text-stone-400' : ''
                      )}
                      style={{ color: isOutOfOrder ? undefined : textMain }}
                      title={sauna.name}
                    >
                      {sauna.name}
                    </h2>
                  </div>

                  {!isOutOfOrder && sauna.info?.temperature != null && (
                    <div
                      className={classNames(
                        'flex items-center font-bold bg-white/40 rounded-full border border-white/50 shrink-0',
                        isUltraCompactLayout ? 'gap-1 px-1.5 py-0.5 text-[9px]' : isCompactLayout ? 'gap-1 px-2 py-0.5 text-[10px]' : 'gap-1.5 px-2.5 py-1 text-[12px]',
                      )}
                      style={{ color: accentGold }}
                    >
                      <Thermometer size={isCompactLayout ? 12 : 14} style={{ color: accentGreen }} />
                      {sauna.info.temperature}°C
                    </div>
                  )}
                </div>

                {isOutOfOrder ? (
                  <div className="absolute inset-0 top-12 bg-white/70 backdrop-blur-[4px] z-10 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                    <AlertTriangle className="text-red-500 w-9 h-9 mb-2 opacity-80" />
                    <span className="text-red-600 font-black uppercase text-[11px] tracking-widest">
                      Außer Betrieb
                    </span>
                  </div>
                ) : infusions.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center opacity-70">
                    <div className="text-[13px] font-black uppercase tracking-widest">
                      Keine Aufgüsse
                    </div>
                  </div>
                ) : (
                  <AutoScrollingList
                    items={sortedInfusions}
                    now={now}
                    prestartMinutes={prestartMinutes}
                    itemComponent={(props) => (
                      <InfusionItemGrid
                        {...props}
                        textMain={textMain}
                        borderColor={border}
                        accentGold={accentGold}
                        statusLive={statusLive}
                        statusPrestart={statusPrestart}
                        compact={isCompactLayout}
                        ultraCompact={isUltraCompactLayout}
                      />
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
