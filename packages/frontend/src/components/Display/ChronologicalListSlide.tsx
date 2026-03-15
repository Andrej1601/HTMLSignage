import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { Flame, Waves } from 'lucide-react';
import type { Schedule, PresetKey } from '@/types/schedule.types';
import { resolveLivePresetKey } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { getDefaultSettings } from '@/types/settings.types';
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

  // Theme colors (computed before useMemo that depends on them)
  const accentGold = theme.accentGold || theme.accent || '#A68A64';
  const accentGreen = theme.accentGreen || theme.timeColBg || '#8F9779';
  const statusLive = theme.statusLive || '#10B981';
  const statusPrestart = theme.statusPrestart || '#F59E0B';
  const prestartMinutes = resolvePrestartMinutes(settings);
  const bgBase = theme.dashboardBg || theme.bg || '#FDFBF7';
  const leftBg = theme.zebra1 || '#F7F3E9';
  const cardBg = theme.cardBg || theme.cellBg || '#FFFFFF';
  const border = theme.gridTable || '#EBE5D3';
  const textMain = theme.textMain || theme.fg || '#3E2723';
  const textMuted = theme.textMuted || theme.fg || '#5D4037';

  // Merge all infusions from all saunas into one sorted list
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
      className="w-full h-full flex flex-col font-sans select-none overflow-hidden p-8"
      style={{ backgroundColor: leftBg, color: textMain }}
    >
      {/* Header */}
      <header className="mb-5 flex justify-between items-center z-20 w-full shrink-0">
        <div className="flex items-center gap-5 min-w-0 flex-1">
          <div
            className="w-14 h-14 bg-white border rounded-2xl flex items-center justify-center shadow-md shrink-0"
            style={{ borderColor: border }}
          >
            <Waves className="w-7 h-7" style={{ color: accentGreen }} />
          </div>
          <div className="min-w-0">
            <p
              className="font-black uppercase tracking-[0.4em] text-[10px] mb-1 opacity-90"
              style={{ color: accentGreen }}
            >
              {header.subtitle?.trim() || 'Aufgussplan'}
            </p>
            <h1 className="text-2xl font-black uppercase tracking-tighter leading-none whitespace-nowrap overflow-hidden text-ellipsis">
              {firstWord}{' '}
              <span style={{ color: accentGold }}>{restWords}</span>
            </h1>
          </div>
        </div>

        <div
          className="bg-white/80 backdrop-blur-md px-6 py-3 rounded-2xl border text-right shadow-sm shrink-0 ml-4"
          style={{ borderColor: border }}
        >
          <p
            className="text-[11px] font-black uppercase tracking-widest mb-0.5"
            style={{ color: accentGold }}
          >
            {formatLongDateDE(now)}
          </p>
          <p className="text-3xl font-black font-mono leading-none" style={{ color: textMain }}>
            {formatClockDE(now)}
          </p>
        </div>
      </header>

      {/* Sauna legend */}
      <div className="flex flex-wrap gap-4 mb-4 shrink-0 px-1">
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
                  className="text-[11px] font-bold uppercase tracking-wider"
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
        className="flex-1 min-h-0 overflow-hidden relative rounded-2xl border shadow-sm"
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
                className={`flex items-center gap-5 px-5 py-4 border-b transition-all ${isFinished ? 'opacity-60' : ''}`}
                style={{
                  backgroundColor: rowBg,
                  borderColor: withAlpha(border, 0.3),
                  borderLeftWidth: '5px',
                  borderLeftColor: leftBarColor,
                }}
              >
                {/* Time */}
                <div className="shrink-0 w-20 text-right">
                  <span
                    className="text-[26px] font-black font-mono leading-none tracking-tight"
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
                <div className="shrink-0 w-40 flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: infusion.saunaAccent }}
                  />
                  <span
                    className="text-[13px] font-black uppercase tracking-wider truncate"
                    style={{ color: isFinished ? withAlpha(textMuted, 0.5) : textMuted }}
                  >
                    {infusion.saunaName}
                  </span>
                </div>

                {/* Infusion title */}
                <div className="flex-1 min-w-0">
                  <span
                    className="text-[18px] font-black uppercase tracking-tight truncate block"
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
                      size={14}
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
                  className="shrink-0 text-[11px] font-black px-2.5 py-1 rounded-full border"
                  style={{
                    color: withAlpha(textMuted, isFinished ? 0.4 : 0.7),
                    borderColor: withAlpha(border, 0.5),
                    backgroundColor: withAlpha(cardBg, 0.5),
                  }}
                >
                  {infusion.duration} MIN
                </div>

                {/* Status badge */}
                <div className="shrink-0 w-20 text-center">
                  {isOngoing && (
                    <motion.span
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="text-[10px] font-black tracking-widest px-3 py-1 rounded-full border"
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
                      className="text-[10px] font-black tracking-widest px-3 py-1 rounded-full border"
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
                      className="text-[9px] font-black tracking-widest uppercase"
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
