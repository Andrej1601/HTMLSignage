import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { AlertTriangle, Clock3, Flame, Thermometer, Waves } from 'lucide-react';
import type { Schedule, PresetKey } from '@/types/schedule.types';
import { resolveLivePresetKey } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { getDefaultSettings } from '@/types/settings.types';
import { isEditorialDisplayAppearance } from '@/config/displayDesignStyles';
import { classNames } from '@/utils/classNames';
import { getVisibleSaunas } from '@/types/sauna.types';
import { clampFlamesTo4, formatClockDE, formatLongDateDE, getInfusionStatus, resolvePrestartMinutes, withAlpha } from './wellnessDisplayUtils';
import {
  buildScheduleSaunaIndexMap,
  getSaunaAccentColor,
  resolveScheduleSaunaIndex,
  timeToMinutes,
} from './displayScheduleUtils';
import { useDisplayViewportProfile } from '@/components/Display/useDisplayViewportProfile';
import {
  buildTimelineBranding,
  buildTimelineGeometry,
  buildTimelineInfusionLayout,
  minutesToTimeLabel,
  type TimelineInfusion,
} from './timelineScheduleUtils';

const START_DELAY_MS = 4000;
const SCROLL_SPEED_PX_PER_SEC = 12;
const LOOP_PAUSE_MS = 900;

interface TimelineScheduleSlideProps {
  schedule: Schedule;
  settings: Settings;
  now?: Date;
  deviceId?: string;
}

function IntensityFlames({
  level,
  size = 10,
  activeColor,
  muted = false,
}: {
  level: number;
  size?: number;
  activeColor: string;
  muted?: boolean;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4].map((i) => (
        <Flame
          key={i}
          size={size}
          className={i <= level ? 'fill-current' : ''}
          style={{
            color: i <= level
              ? (muted ? withAlpha(activeColor, 0.45) : activeColor)
              : withAlpha(activeColor, muted ? 0.18 : 0.28),
          }}
        />
      ))}
    </div>
  );
}

function TimelineInfusionCard({
  infusion,
  now,
  prestartMinutes,
  textMain,
  borderColor,
  cardBg,
  accentGold,
  statusLive,
  statusPrestart,
  rowHeight,
}: {
  infusion: TimelineInfusion;
  now: Date;
  prestartMinutes: number;
  textMain: string;
  borderColor: string;
  cardBg: string;
  accentGold: string;
  statusLive: string;
  statusPrestart: string;
  rowHeight: number;
}) {
  const status = getInfusionStatus(now, infusion.time, infusion.duration, prestartMinutes);
  const isOngoing = status === 'ONGOING';
  const isPrestart = status === 'PRESTART';
  const isFinished = status === 'FINISHED';

  const containerBg = isOngoing
    ? withAlpha(statusLive, 0.18)
    : isPrestart
      ? withAlpha(statusPrestart, 0.16)
      : isFinished
        ? withAlpha(cardBg, 0.45)
        : withAlpha(cardBg, 0.86);

  const containerBorder = isOngoing
    ? withAlpha(statusLive, 0.5)
    : isPrestart
      ? withAlpha(statusPrestart, 0.45)
      : isFinished
        ? withAlpha(borderColor, 0.4)
        : withAlpha(borderColor, 0.75);

  const titleColor = isFinished ? withAlpha(textMain, 0.62) : textMain;
  const badgeBg = isOngoing
    ? withAlpha(statusLive, 0.16)
    : isPrestart
      ? withAlpha(statusPrestart, 0.16)
      : withAlpha(borderColor, 0.2);
  const badgeFg = isOngoing
    ? statusLive
    : isPrestart
      ? statusPrestart
      : withAlpha(textMain, 0.55);
  const cardPadding = Math.max(4, Math.min(12, rowHeight * 0.1));
  const titleFontSize = Math.max(11, Math.min(24, rowHeight * 0.24));
  const badgeFontSize = Math.max(9, Math.min(15, rowHeight * 0.17));
  const flameSize = Math.max(10, Math.min(20, rowHeight * 0.22));
  const rowGap = Math.max(3, Math.min(8, rowHeight * 0.1));
  const metaBottomInset = Math.max(5, Math.min(12, rowHeight * 0.15));
  const metaLift = Math.max(3, Math.min(9, rowHeight * 0.12));
  const dividerColor = withAlpha(borderColor, 0.3);
  const titleLineHeight = 1.15;
  const titleBlockMinHeight = Math.max(20, Math.ceil(titleFontSize * titleLineHeight + 2));

  return (
    <div
      className={`h-full w-full rounded-xl border shadow-xs flex flex-col overflow-hidden ${
        isFinished ? 'opacity-75' : ''
      }`}
      style={{
        backgroundColor: containerBg,
        borderColor: containerBorder,
        padding: `${cardPadding}px`,
      }}
    >
      <div
        className="shrink-0"
        style={{
          minHeight: `${titleBlockMinHeight}px`,
          paddingBottom: `${rowGap}px`,
        }}
      >
        <h5
          className="font-black uppercase tracking-tight leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
          style={{
            color: titleColor,
            fontSize: `${titleFontSize}px`,
            lineHeight: titleLineHeight,
          }}
        >
          {infusion.title}
        </h5>
      </div>

      <div
        className="shrink-0"
        style={{
          borderTop: `1px solid ${dividerColor}`,
        }}
      />

      <div
        className="shrink-0 flex items-center justify-between gap-2"
        style={{
          paddingTop: `${rowGap}px`,
          paddingBottom: `${metaBottomInset}px`,
          transform: `translateY(-${metaLift}px)`,
        }}
      >
        <IntensityFlames
          level={infusion.intensity}
          size={flameSize}
          activeColor={isOngoing ? statusLive : accentGold}
          muted={isFinished}
        />
        <span
          className="font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0"
          style={{
            color: badgeFg,
            backgroundColor: badgeBg,
            borderColor: withAlpha(badgeFg, 0.25),
            fontSize: `${badgeFontSize}px`,
          }}
        >
          {isOngoing ? 'Läuft' : isPrestart ? 'Gleich' : isFinished ? 'Vorbei' : infusion.time}
        </span>
      </div>
    </div>
  );
}

export function TimelineScheduleSlide({ schedule, settings, now: nowProp, deviceId }: TimelineScheduleSlideProps) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;
  const header = settings.header || defaults.header!;

  const [clockNow, setClockNow] = useState(() => nowProp ?? new Date());
  const [viewportHeight, setViewportHeight] = useState(0);
  const { containerRef, profile } = useDisplayViewportProfile<HTMLDivElement>();

  useEffect(() => {
    if (nowProp) return undefined;
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

  const infusionsBySauna = useMemo(() => {
    const map = new Map<string, TimelineInfusion[]>();

    gridSaunas.forEach((sauna) => {
      const saunaIndex = resolveScheduleSaunaIndex(
        daySchedule?.saunas || [],
        sauna.name,
        scheduleSaunaIndexByKey,
      );

      const items = (daySchedule?.rows || [])
        .map((row) => {
          const entry = saunaIndex >= 0 ? row.entries?.[saunaIndex] : null;
          if (!entry?.title) return null;
          return {
            id: `${activePresetKey}-${sauna.id}-${row.time}-${entry.title}`,
            time: row.time,
            duration: entry.duration ?? 15,
            title: entry.title,
            intensity: clampFlamesTo4(entry.flames ?? 1),
          } satisfies TimelineInfusion;
        })
        .filter(Boolean) as TimelineInfusion[];

      items.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
      map.set(sauna.id, items);
    });

    return map;
  }, [activePresetKey, daySchedule?.rows, daySchedule?.saunas, gridSaunas, scheduleSaunaIndexByKey]);

  const allInfusions = useMemo(
    () => Array.from(infusionsBySauna.values()).flat(),
    [infusionsBySauna]
  );

  const timeline = useMemo(() => {
    return buildTimelineGeometry(
      (daySchedule?.rows || []).map((row) => row.time),
      allInfusions,
      viewportHeight,
    );
  }, [allInfusions, daySchedule?.rows, viewportHeight]);

  const accentGold = theme.accentGold || theme.accent || '#A68A64';
  const accentGreen = theme.accentGreen || theme.timeColBg || '#8F9779';
  const leftBg = theme.zebra1 || '#F7F3E9';
  const cardBg = theme.cardBg || theme.cellBg || '#FFFFFF';
  const border = theme.gridTable || '#EBE5D3';
  const textMain = theme.textMain || theme.fg || '#3E2723';
  const textMuted = theme.textMuted || theme.fg || '#5D4037';
  const statusLive = theme.statusLive || '#10B981';
  const statusPrestart = theme.statusPrestart || '#F59E0B';
  const prestartMinutes = resolvePrestartMinutes(settings);
  const isEditorial = isEditorialDisplayAppearance(settings.displayAppearance);
  const isCompactLayout = profile.isCompact || profile.isNarrow;
  const isUltraCompactLayout = profile.isUltraCompact || profile.isShort;
  const compactHeader = !isEditorial && (profile.isNarrow || profile.isPortrait);

  const { firstWord, restWords } = useMemo(
    () => buildTimelineBranding(header.logoText || ''),
    [header.logoText],
  );

  const timeColWidth = 'w-20';
  const gridTemplateColumns = `repeat(${Math.max(1, gridSaunas.length)}, minmax(0, 1fr))`;

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const update = () => {
      setViewportHeight(element.clientHeight || 0);
    };

    let rafA = requestAnimationFrame(update);
    let rafB = requestAnimationFrame(update);

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(element);
    window.addEventListener('resize', update);

    return () => {
      cancelAnimationFrame(rafA);
      cancelAnimationFrame(rafB);
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const scrollSignature = useMemo(() => {
    const saunaPart = gridSaunas.map((s) => s.id).join(',');
    const infusionPart = allInfusions
      .map((item) => `${item.id}:${item.time}:${item.duration}:${item.title}`)
      .join('|');
    return `${activePresetKey}|${saunaPart}|${infusionPart}|${timeline?.contentHeight || 0}`;
  }, [activePresetKey, allInfusions, gridSaunas, timeline?.contentHeight]);

  useEffect(() => {
    let cancelled = false;

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    controls.stop();
    controls.set({ y: 0 });

    const run = async () => {
      await sleep(START_DELAY_MS);
      if (cancelled) return;

      while (!cancelled) {
        const viewport = viewportRef.current;
        const content = contentRef.current;
        if (!viewport || !content) return;

        const maxScroll = Math.max(0, content.scrollHeight - viewport.clientHeight);
        if (maxScroll <= 6) return;

        const durationSec = maxScroll / SCROLL_SPEED_PX_PER_SEC;
        try {
          await controls.start({
            y: -maxScroll,
            transition: {
              duration: durationSec,
              ease: 'linear',
            },
          });
        } catch {
          return;
        }

        if (cancelled) return;
        await sleep(LOOP_PAUSE_MS);
        if (cancelled) return;
        controls.set({ y: 0 });
        await sleep(START_DELAY_MS);
        if (cancelled) return;
      }
    };

    run();

    return () => {
      cancelled = true;
      controls.stop();
    };
  }, [controls, scrollSignature]);

  if (gridSaunas.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8" style={{ backgroundColor: leftBg, color: textMain }}>
        <div className="text-center">
          <div className="text-sm font-black uppercase tracking-[0.3em] mb-2" style={{ color: accentGold }}>
            Timeline
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tight">Keine Saunen sichtbar</h2>
        </div>
      </div>
    );
  }

  if (!timeline) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8" style={{ backgroundColor: leftBg, color: textMain }}>
        <div className="text-center">
          <div className="text-sm font-black uppercase tracking-[0.3em] mb-2" style={{ color: accentGold }}>
            Timeline
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tight">Kein Aufgussplan für diesen Tag</h2>
        </div>
      </div>
    );
  }

  const hasVerticalOverflow = viewportHeight > 0 && (timeline.contentHeight - viewportHeight) > 4;

  return (
    <div
      ref={containerRef}
      className={classNames(
        'w-full h-full flex flex-col overflow-hidden',
        isEditorial ? (isCompactLayout ? 'p-3' : 'p-4') : isCompactLayout ? 'p-4' : 'p-6',
      )}
      style={{ backgroundColor: leftBg, color: textMain }}
    >
      {!isEditorial && (
        <header className={classNames('z-10 w-full px-1 shrink-0', compactHeader ? 'mb-3 flex flex-col gap-3' : 'mb-4 flex items-end justify-between gap-4')}>
        <div className={classNames('flex items-center min-w-0', isCompactLayout ? 'gap-3' : 'gap-5')}>
          <div
            className={classNames(
              'rounded-2xl flex items-center justify-center shadow-md border',
              isCompactLayout ? 'h-11 w-11' : 'h-14 w-14',
            )}
            style={{
              backgroundColor: withAlpha(cardBg, 0.92),
              borderColor: withAlpha(border, 0.9),
            }}
          >
            <Waves className={classNames(isCompactLayout ? 'h-5 w-5' : 'h-7 w-7')} style={{ color: accentGreen }} />
          </div>
          <div className="min-w-0">
            <p
              className={classNames(
                'font-black uppercase mb-0.5 opacity-90',
                isUltraCompactLayout ? 'text-[8px] tracking-[0.22em]' : isCompactLayout ? 'text-[9px] tracking-[0.28em]' : 'text-[10px] tracking-[0.5em]',
              )}
              style={{ color: accentGreen }}
            >
              {header.subtitle && header.subtitle.trim() !== '' ? header.subtitle : 'Aufgussplan'}
            </p>
            <h1
              className={classNames(
                'font-black uppercase tracking-tighter leading-none overflow-hidden text-ellipsis',
                isUltraCompactLayout ? 'text-[24px] whitespace-normal' : isCompactLayout ? 'text-[34px]' : 'text-[52px] whitespace-nowrap',
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
            'text-right shrink-0 border backdrop-blur-xs',
            compactHeader ? 'self-stretch rounded-2xl px-4 py-2.5' : isCompactLayout ? 'rounded-2xl px-4 py-3' : 'rounded-3xl px-6 py-4',
          )}
          style={{
            backgroundColor: withAlpha(cardBg, 0.68),
            borderColor: withAlpha(border, 0.85),
          }}
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
              'font-black font-mono leading-none tracking-tight',
              isUltraCompactLayout ? 'text-[32px]' : isCompactLayout ? 'text-[44px]' : 'text-6xl',
            )}
            style={{ color: textMain }}
          >
            {formatClockDE(now)}
          </p>
        </div>
        </header>
      )}

      <div
        className="flex-1 min-h-0 rounded-[2rem] border shadow-xs overflow-hidden relative flex flex-col"
        style={{
          borderColor: withAlpha(border, 0.9),
          backgroundColor: withAlpha(cardBg, 0.35),
        }}
      >
        <div
          className="flex border-b sticky top-0 z-20 backdrop-blur-xl"
          style={{
            borderColor: withAlpha(border, 0.8),
            backgroundColor: withAlpha(cardBg, 0.92),
          }}
        >
          <div
            className={`${timeColWidth} shrink-0 flex items-center justify-center border-r`}
            style={{
              borderColor: withAlpha(border, 0.8),
              backgroundColor: withAlpha(accentGold, 0.07),
            }}
          >
            <Clock3 size={16} style={{ color: accentGold }} />
          </div>
          <div className="flex-1 grid" style={{ gridTemplateColumns }}>
            {gridSaunas.map((sauna, idx) => {
              const saunaAccent = getSaunaAccentColor(sauna, idx, accentGreen, accentGold);
              const outOfOrder = sauna.status === 'out-of-order';

              return (
                <div
                  key={sauna.id}
                  className={classNames('border-r last:border-r-0 overflow-hidden', isCompactLayout ? 'px-1.5 py-2' : 'px-2 py-2.5')}
                  style={{ borderColor: withAlpha(border, 0.65) }}
                >
                  <div className="flex items-center justify-center gap-2 min-w-0">
                    <div
                      className={classNames('rounded-full shrink-0', isCompactLayout ? 'h-4 w-1.5' : 'h-5 w-2')}
                      style={{
                        backgroundColor: outOfOrder ? withAlpha(textMuted, 0.5) : saunaAccent,
                      }}
                    />
                    <span
                      className={classNames(
                        'font-black uppercase truncate',
                        isUltraCompactLayout ? 'text-[9px] tracking-[0.08em]' : isCompactLayout ? 'text-[10px] tracking-[0.1em]' : 'text-[12px] tracking-[0.14em]',
                      )}
                      style={{
                        color: outOfOrder ? withAlpha(textMain, 0.45) : textMain,
                      }}
                      title={sauna.name}
                    >
                      {sauna.name}
                    </span>
                    {!outOfOrder && sauna.info?.temperature != null && (
                      <span
                        className={classNames(
                          'font-black rounded-full border flex items-center gap-1 shrink-0',
                          isUltraCompactLayout ? 'text-[8px] px-1.5 py-0.5' : isCompactLayout ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5',
                        )}
                        style={{
                          color: accentGold,
                          borderColor: withAlpha(border, 0.7),
                          backgroundColor: withAlpha(cardBg, 0.7),
                        }}
                      >
                        <Thermometer size={isCompactLayout ? 10 : 12} style={{ color: accentGreen }} />
                        {sauna.info.temperature}°C
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div ref={viewportRef} className="flex-1 min-h-0 overflow-hidden relative">
          <motion.div
            ref={contentRef}
            animate={controls}
            initial={{ y: 0 }}
            className="flex"
            style={{ minHeight: `${timeline.contentHeight}px` }}
          >
            <div
              className={`${timeColWidth} shrink-0 border-r relative`}
              style={{
                borderColor: withAlpha(border, 0.7),
                backgroundColor: withAlpha(accentGold, 0.05),
                height: `${timeline.contentHeight}px`,
              }}
            >
              {timeline.segments.map((segment) => (
                <div
                  key={`time-${segment.minute}`}
                  className="absolute left-0 right-0 border-b"
                  style={{
                    top: `${segment.top}px`,
                    height: `${segment.height}px`,
                    borderColor: withAlpha(border, 0.35),
                    backgroundColor: segment.striped ? withAlpha(accentGold, 0.07) : 'transparent',
                  }}
                >
                  <span
                    className="absolute left-1/2 -translate-x-1/2 font-black font-mono leading-none"
                    style={(() => {
                      const fontSize = Math.max(13, Math.min(20, timeline.rowHeight * 0.3));
                      const top = Math.max(2, (segment.height - fontSize) / 2);
                      return {
                        top: `${top}px`,
                        fontSize: `${fontSize}px`,
                        color: withAlpha(accentGold, 0.95),
                      };
                    })()}
                  >
                    {minutesToTimeLabel(segment.minute)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex-1 relative" style={{ height: `${timeline.contentHeight}px` }}>
              <div className="absolute inset-0 grid" style={{ gridTemplateColumns }}>
                {gridSaunas.map((sauna, idx) => {
                  const infusions = infusionsBySauna.get(sauna.id) || [];
                  const saunaAccent = getSaunaAccentColor(sauna, idx, accentGreen, accentGold);
                  const outOfOrder = sauna.status === 'out-of-order';

                  return (
                    <div key={sauna.id} className="relative border-r last:border-r-0" style={{ borderColor: withAlpha(border, 0.35) }}>
                      {timeline.segments.map((segment) => (
                        <div
                          key={`${sauna.id}-${segment.minute}`}
                          className="absolute left-0 right-0 border-b"
                          style={{
                            top: `${segment.top}px`,
                            height: `${segment.height}px`,
                            borderColor: withAlpha(border, 0.35),
                            backgroundColor: segment.striped ? withAlpha(accentGreen, 0.05) : 'transparent',
                          }}
                        />
                      ))}

                      {infusions.map((infusion) => {
                        const layout = buildTimelineInfusionLayout(infusion, timeline);

                        return (
                          <motion.div
                            key={infusion.id}
                            initial={{ opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                            className="absolute left-[3%] w-[94%]"
                            style={{ top: `${layout.top}px`, height: `${layout.height}px` }}
                          >
                            <TimelineInfusionCard
                              infusion={infusion}
                              now={now}
                              prestartMinutes={prestartMinutes}
                              textMain={textMain}
                              borderColor={border}
                              cardBg={cardBg}
                              accentGold={saunaAccent || accentGold}
                              statusLive={statusLive}
                              statusPrestart={statusPrestart}
                              rowHeight={timeline.rowHeight}
                            />
                          </motion.div>
                        );
                      })}

                      {!outOfOrder && infusions.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: withAlpha(textMuted, 0.7) }}>
                            Keine Aufgüsse
                          </span>
                        </div>
                      )}

                      {outOfOrder && (
                        <div
                          className="absolute inset-2 rounded-xl border backdrop-blur-xs flex flex-col items-center justify-center text-center px-2"
                          style={{
                            backgroundColor: withAlpha(cardBg, 0.75),
                            borderColor: withAlpha('#DC2626', 0.28),
                          }}
                        >
                          <AlertTriangle className="w-6 h-6 mb-1.5" style={{ color: '#DC2626' }} />
                          <span className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: '#B91C1C' }}>
                            Außer Betrieb
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {hasVerticalOverflow && (
            <div
              className="absolute top-0 left-0 right-0 h-4 pointer-events-none z-10"
              style={{ background: `linear-gradient(to bottom, ${leftBg}, ${withAlpha(leftBg, 0)})` }}
            />
          )}
          {hasVerticalOverflow && (
            <div
              className="absolute bottom-0 left-0 right-0 h-4 pointer-events-none z-10"
              style={{ background: `linear-gradient(to top, ${leftBg}, ${withAlpha(leftBg, 0)})` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
