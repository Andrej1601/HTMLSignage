import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { Flame, Waves } from 'lucide-react';
import type { Schedule, PresetKey } from '@/types/schedule.types';
import { resolveLivePresetKey } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { getDefaultSettings } from '@/types/settings.types';
import { isEditorialDisplayAppearance, isMineralNoirDisplayAppearance } from '@/config/displayDesignStyles';
import { classNames } from '@/utils/classNames';
import { getVisibleSaunas } from '@/types/sauna.types';
import {
  clampFlamesTo4,
  formatClockDE,
  formatLongDateDE,
  getInfusionStatus,
  resolvePrestartMinutes,
  withAlpha,
} from './wellnessDisplayUtils';
import {
  buildScheduleSaunaIndexMap,
  getSaunaAccentColor,
  resolveScheduleSaunaIndex,
  timeToMinutes,
} from './displayScheduleUtils';
import { useDisplayViewportProfile } from '@/components/Display/useDisplayViewportProfile';

const SCROLL_SPEED = 14;
const START_DELAY = 4000;
const LOOP_PAUSE = 1200;

interface ChronologicalListSlideProps {
  schedule: Schedule;
  settings: Settings;
  now?: Date;
  deviceId?: string;
}

interface MergedInfusion {
  id: string;
  time: string;
  duration: number;
  title: string;
  intensity: number;
  saunaName: string;
  saunaAccent: string;
}

export function ChronologicalListSlide({ schedule, settings, now: nowProp, deviceId }: ChronologicalListSlideProps) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;
  const header = settings.header || defaults.header!;

  const [clockNow, setClockNow] = useState(() => nowProp ?? new Date());
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
    [daySchedule?.saunas],
  );

  const visibleSaunas = useMemo(() => getVisibleSaunas(settings.saunas || []), [settings.saunas]);

  // Theme colors — destructured for stable compiler deps
  const { accentGold: _accentGold, accent: _accent, accentGreen: _accentGreen, timeColBg: _timeColBg } = theme;
  const accentGold = _accentGold || _accent || '#A68A64';
  const accentGreen = _accentGreen || _timeColBg || '#8F9779';
  const statusLive = theme.statusLive || '#10B981';
  const statusPrestart = theme.statusPrestart || '#F59E0B';
  const prestartMinutes = resolvePrestartMinutes(settings);
  const bgBase = theme.dashboardBg || theme.bg || '#FDFBF7';
  const leftBg = theme.zebra1 || '#F7F3E9';
  const cardBg = theme.cardBg || theme.cellBg || '#FFFFFF';
  const border = theme.gridTable || '#EBE5D3';
  const textMain = theme.textMain || theme.fg || '#3E2723';
  const textMuted = theme.textMuted || theme.fg || '#5D4037';
  const isEditorial = isEditorialDisplayAppearance(settings.displayAppearance);
  const isMineralNoir = isMineralNoirDisplayAppearance(settings.displayAppearance);
  const hideBuiltInHeader = isEditorial || isMineralNoir;
  const isCompactLayout = profile.isCompact || profile.isNarrow;
  const isUltraCompactLayout = profile.isUltraCompact || profile.isShort;
  const compactHeader = !isEditorial && (profile.isNarrow || profile.isPortrait);

  // Merge all infusions from all saunas into one sorted list
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- complex display computation, keep manual memo for perf
  const allInfusions = useMemo(() => {
    if (!daySchedule) return [];

    const merged: MergedInfusion[] = [];

    visibleSaunas.forEach((sauna, idx) => {
      if (sauna.status === 'out-of-order') return;

      const saunaIndex = resolveScheduleSaunaIndex(
        daySchedule.saunas,
        sauna.name,
        scheduleSaunaIndexByKey,
      );

      const accent = getSaunaAccentColor(sauna, idx, accentGreen, accentGold);

      daySchedule.rows.forEach((row) => {
        const entry = saunaIndex >= 0 ? row.entries?.[saunaIndex] : null;
        if (!entry?.title) return;

        merged.push({
          id: `${activePresetKey}-${sauna.id}-${row.time}-${entry.title}`,
          time: row.time,
          duration: entry.duration ?? 15,
          title: entry.title,
          intensity: clampFlamesTo4(entry.flames ?? 1),
          saunaName: sauna.name,
          saunaAccent: accent,
        });
      });
    });

    return merged.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [daySchedule, visibleSaunas, scheduleSaunaIndexByKey, activePresetKey, accentGreen, accentGold]);

  // --- Auto-scroll logic ---
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const [viewportHeight, setViewportHeight] = useState(0);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setViewportHeight(el.clientHeight || 0);
    const raf = requestAnimationFrame(update);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);

  const scrollSignature = useMemo(
    () => `${activePresetKey}|${allInfusions.length}|${viewportHeight}`,
    [activePresetKey, allInfusions.length, viewportHeight],
  );

  useEffect(() => {
    let cancelled = false;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    controls.stop();
    controls.set({ y: 0 });

    const run = async () => {
      await sleep(START_DELAY);
      if (cancelled) return;

      while (!cancelled) {
        const viewport = viewportRef.current;
        const content = contentRef.current;
        if (!viewport || !content) return;

        const maxScroll = Math.max(0, content.scrollHeight - viewport.clientHeight);
        if (maxScroll <= 6) return;

        const dur = maxScroll / SCROLL_SPEED;
        try {
          await controls.start({ y: -maxScroll, transition: { duration: dur, ease: 'linear' } });
        } catch {
          return;
        }
        if (cancelled) return;
        await sleep(LOOP_PAUSE);
        if (cancelled) return;
        controls.set({ y: 0 });
        await sleep(START_DELAY);
        if (cancelled) return;
      }
    };

    run();
    return () => {
      cancelled = true;
      controls.stop();
    };
  }, [controls, scrollSignature]);

  // --- Header text ---
  const rawLogoText = (header.logoText || '').trim();
  const logoText =
    !rawLogoText || /^html\s*signage$/i.test(rawLogoText) ? 'Westfalenbad Hagen' : rawLogoText;
  const titleWords = logoText.split(' ');
  const firstWord = titleWords[0] || 'Westfalenbad';
  const restWords = titleWords.slice(1).join(' ') || 'Hagen';

  // --- Empty state ---
  if (!daySchedule || allInfusions.length === 0) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: bgBase, color: textMain }}
      >
        <div className="text-center max-w-2xl px-8">
          <div
            className="text-[10px] font-black uppercase tracking-[0.4em] opacity-70 mb-2"
            style={{ color: accentGreen }}
          >
            Chronologische Übersicht
          </div>
          <div className="text-3xl font-black uppercase tracking-tighter leading-none mb-4">
            Noch keine Aufgüsse geplant
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={classNames(
        'w-full h-full flex flex-col font-sans select-none overflow-hidden',
        isEditorial ? (isCompactLayout ? 'p-3.5' : 'p-5') : isCompactLayout ? 'p-4' : 'p-8',
      )}
      style={{ backgroundColor: leftBg, color: textMain }}
    >
      {!hideBuiltInHeader && (
        <header className={classNames('z-20 w-full shrink-0', compactHeader ? 'mb-3 flex flex-col gap-3' : 'mb-5 flex items-center justify-between')}>
        <div className={classNames('flex items-center min-w-0 flex-1', isCompactLayout ? 'gap-3' : 'gap-5')}>
          <div
            className={classNames(
              'bg-white border rounded-2xl flex items-center justify-center shadow-md shrink-0',
              isCompactLayout ? 'h-11 w-11' : 'h-14 w-14',
            )}
            style={{ borderColor: border }}
          >
            <Waves className={classNames(isCompactLayout ? 'h-5 w-5' : 'h-7 w-7')} style={{ color: accentGreen }} />
          </div>
          <div className="min-w-0">
            <p
              className={classNames(
                'font-black uppercase opacity-90',
                isUltraCompactLayout ? 'mb-0.5 text-[8px] tracking-[0.22em]' : isCompactLayout ? 'mb-0.5 text-[9px] tracking-[0.28em]' : 'mb-1 text-[10px] tracking-[0.4em]',
              )}
              style={{ color: accentGreen }}
            >
              {header.subtitle?.trim() || 'Aufgussplan'}
            </p>
            <h1
              className={classNames(
                'font-black uppercase tracking-tighter leading-none overflow-hidden text-ellipsis',
                isUltraCompactLayout ? 'text-[22px] whitespace-normal' : isCompactLayout ? 'text-[26px]' : 'text-2xl whitespace-nowrap',
              )}
            >
              {firstWord}{' '}
              <span style={{ color: accentGold }}>{restWords}</span>
            </h1>
          </div>
        </div>

        <div
          className={classNames(
            'bg-white/80 backdrop-blur-md border text-right shadow-xs shrink-0',
            compactHeader ? 'self-stretch rounded-2xl px-4 py-2.5' : isCompactLayout ? 'ml-3 rounded-2xl px-4 py-2.5' : 'ml-4 rounded-2xl px-6 py-3',
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
              isUltraCompactLayout ? 'text-[28px]' : isCompactLayout ? 'text-[32px]' : 'text-3xl',
            )}
            style={{ color: textMain }}
          >
            {formatClockDE(now)}
          </p>
        </div>
        </header>
      )}

      {/* Sauna legend */}
      <div className={classNames('flex flex-wrap shrink-0 px-1', isEditorial ? 'mb-3' : 'mb-4', isCompactLayout ? 'gap-2.5' : 'gap-4')}>
        {visibleSaunas
          .filter((s) => s.status !== 'out-of-order')
          .map((sauna, idx) => {
            const accent = getSaunaAccentColor(sauna, idx, accentGreen, accentGold);
            return (
              <div key={sauna.id} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: accent }}
                />
                <span
                  className={classNames(
                    'font-bold uppercase',
                    isUltraCompactLayout ? 'text-[9px] tracking-[0.08em]' : 'text-[11px] tracking-wider',
                  )}
                  style={{ color: textMuted }}
                >
                  {sauna.name}
                </span>
              </div>
            );
          })}
      </div>

      {/* Scrollable list */}
      <div
        ref={viewportRef}
        className="flex-1 min-h-0 overflow-hidden relative rounded-2xl border shadow-xs"
        style={{
          borderColor: withAlpha(border, 0.9),
          backgroundColor: withAlpha(cardBg, 0.4),
        }}
      >
        <motion.div ref={contentRef} animate={controls} initial={{ y: 0 }}>
          {allInfusions.map((infusion, i) => {
            const status = getInfusionStatus(now, infusion.time, infusion.duration, prestartMinutes);
            const isOngoing = status === 'ONGOING';
            const isPrestart = status === 'PRESTART';
            const isFinished = status === 'FINISHED';
            const isEven = i % 2 === 0;

            const rowBg = isOngoing
              ? withAlpha(statusLive, 0.12)
              : isPrestart
                ? withAlpha(statusPrestart, 0.1)
                : isFinished
                  ? withAlpha(cardBg, 0.3)
                  : isEven
                    ? withAlpha(cardBg, 0.65)
                    : withAlpha(cardBg, 0.35);

            const leftBarColor = isOngoing
              ? statusLive
              : isPrestart
                ? statusPrestart
                : infusion.saunaAccent;

            return (
              <div
                key={infusion.id}
                className={classNames(
                  'flex items-center border-b transition-all',
                  isUltraCompactLayout ? 'gap-2.5 px-3 py-2.5' : isCompactLayout ? 'gap-3.5 px-4 py-3' : 'gap-5 px-5 py-4',
                  isFinished && 'opacity-60',
                )}
                style={{
                  backgroundColor: rowBg,
                  borderColor: withAlpha(border, 0.3),
                  borderLeftWidth: '5px',
                  borderLeftColor: leftBarColor,
                }}
              >
                {/* Time */}
                <div className={classNames('shrink-0 text-right', isUltraCompactLayout ? 'w-14' : isCompactLayout ? 'w-16' : 'w-20')}>
                  <span
                    className={classNames(
                      'font-black font-mono leading-none tracking-tight',
                      isUltraCompactLayout ? 'text-[18px]' : isCompactLayout ? 'text-[22px]' : 'text-[26px]',
                    )}
                    style={{
                      color: isOngoing
                        ? statusLive
                        : isPrestart
                          ? statusPrestart
                          : isFinished
                            ? withAlpha(textMain, 0.4)
                            : textMain,
                    }}
                  >
                    {infusion.time}
                  </span>
                </div>

                {/* Sauna dot + name */}
                <div className={classNames('shrink-0 flex items-center min-w-0', isUltraCompactLayout ? 'w-24 gap-1.5' : isCompactLayout ? 'w-28 gap-2' : 'w-40 gap-2.5')}>
                  <div
                    className={classNames('rounded-full shrink-0', isCompactLayout ? 'h-2.5 w-2.5' : 'h-3 w-3')}
                    style={{ backgroundColor: infusion.saunaAccent }}
                  />
                  <span
                    className={classNames(
                      'font-black uppercase truncate',
                      isUltraCompactLayout ? 'text-[9px] tracking-[0.08em]' : isCompactLayout ? 'text-[10px] tracking-[0.1em]' : 'text-[13px] tracking-wider',
                    )}
                    style={{ color: isFinished ? withAlpha(textMuted, 0.5) : textMuted }}
                  >
                    {infusion.saunaName}
                  </span>
                </div>

                {/* Infusion title */}
                <div className="flex-1 min-w-0">
                  <span
                    className={classNames(
                      'font-black uppercase tracking-tight truncate block',
                      isUltraCompactLayout ? 'text-[12px]' : isCompactLayout ? 'text-[15px]' : 'text-[18px]',
                    )}
                    style={{ color: isFinished ? withAlpha(textMain, 0.5) : textMain }}
                  >
                    {infusion.title}
                  </span>
                </div>

                {/* Flames */}
                <div className="flex gap-0.5 shrink-0">
                  {[1, 2, 3, 4].map((lvl) => (
                    <Flame
                      key={lvl}
                      size={isCompactLayout ? 12 : 14}
                      className={lvl <= infusion.intensity ? 'fill-current' : ''}
                      style={{
                        color:
                          lvl <= infusion.intensity
                            ? isFinished
                              ? withAlpha(accentGold, 0.35)
                              : isOngoing
                                ? statusLive
                                : accentGold
                            : withAlpha(accentGold, 0.2),
                      }}
                    />
                  ))}
                </div>

                {/* Duration */}
                <div
                  className={classNames(
                    'shrink-0 font-black rounded-full border',
                    isUltraCompactLayout ? 'text-[8px] px-1.5 py-0.5' : isCompactLayout ? 'text-[9px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1',
                  )}
                  style={{
                    color: withAlpha(textMuted, isFinished ? 0.4 : 0.7),
                    borderColor: withAlpha(border, 0.5),
                    backgroundColor: withAlpha(cardBg, 0.5),
                  }}
                >
                  {infusion.duration} MIN
                </div>

                {/* Status badge */}
                <div className={classNames('shrink-0 text-center', isUltraCompactLayout ? 'w-14' : isCompactLayout ? 'w-16' : 'w-20')}>
                  {isOngoing && (
                    <motion.span
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className={classNames(
                        'font-black rounded-full border',
                        isUltraCompactLayout ? 'text-[8px] tracking-[0.08em] px-2 py-0.5' : isCompactLayout ? 'text-[9px] tracking-[0.1em] px-2.5 py-0.5' : 'text-[10px] tracking-widest px-3 py-1',
                      )}
                      style={{
                        color: statusLive,
                        backgroundColor: withAlpha(statusLive, 0.15),
                        borderColor: withAlpha(statusLive, 0.3),
                      }}
                    >
                      LÄUFT
                    </motion.span>
                  )}
                  {isPrestart && (
                    <span
                      className={classNames(
                        'font-black rounded-full border',
                        isUltraCompactLayout ? 'text-[8px] tracking-[0.08em] px-2 py-0.5' : isCompactLayout ? 'text-[9px] tracking-[0.1em] px-2.5 py-0.5' : 'text-[10px] tracking-widest px-3 py-1',
                      )}
                      style={{
                        color: statusPrestart,
                        backgroundColor: withAlpha(statusPrestart, 0.12),
                        borderColor: withAlpha(statusPrestart, 0.3),
                      }}
                    >
                      GLEICH
                    </span>
                  )}
                  {isFinished && (
                    <span
                      className={classNames(
                        'font-black uppercase',
                        isUltraCompactLayout ? 'text-[8px] tracking-[0.08em]' : 'text-[9px] tracking-widest',
                      )}
                      style={{ color: withAlpha(textMain, 0.3) }}
                    >
                      Vorbei
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Scroll fade overlays */}
        {viewportHeight > 0 && (
          <>
            <div
              className="absolute top-0 left-0 right-0 h-6 pointer-events-none z-10"
              style={{ background: `linear-gradient(to bottom, ${leftBg}, ${withAlpha(leftBg, 0)})` }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none z-10"
              style={{ background: `linear-gradient(to top, ${leftBg}, ${withAlpha(leftBg, 0)})` }}
            />
          </>
        )}
      </div>
    </div>
  );
}
