import { useEffect, useMemo, useState } from 'react';
import type { Schedule, PresetKey } from '@/types/schedule.types';
import { getActivePresetKey, getTodayPresetKey } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { getDefaultSettings } from '@/types/settings.types';
import { getVisibleSaunas } from '@/types/sauna.types';
import { AlertTriangle, Thermometer, Waves, Flame } from 'lucide-react';
import { AutoScrollingList, type InfusionListItem } from './AutoScrollingList';
import { clampFlamesTo4, formatClockDE, formatLongDateDE, withAlpha } from './wellnessDisplayUtils';
import { motion } from 'framer-motion';
import {
  buildScheduleSaunaIndexMap,
  getSaunaAccentColor,
  resolveScheduleSaunaIndex,
  timeToMinutes,
} from './displayScheduleUtils';

interface ScheduleGridSlideProps {
  schedule: Schedule;
  settings: Settings;
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
}: {
  infusion: SaunaInfusionItem;
  status: 'ONGOING' | 'PRESTART' | 'UPCOMING' | 'FINISHED';
  textMain: string;
  borderColor: string;
  accentGold: string;
  statusLive: string;
  statusPrestart: string;
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

  return (
    <div
      className={`relative p-3.5 rounded-xl mb-3 border transition-all duration-500 shadow-sm ${isFinished ? 'opacity-70' : ''}`}
      style={{
        backgroundColor: containerBg,
        borderColor: containerBorder,
      }}
    >
      <div className="flex justify-between items-center mb-0.5">
        <div className="flex items-center gap-2">
          <span
            className="text-[18px] font-black tracking-tight"
            style={{ color: timeColor }}
          >
            {infusion.time}
          </span>
          {isOngoing && (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-[10px] font-black tracking-wider px-2 py-0.5 rounded border"
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
            <span className="text-[9px] font-black uppercase tracking-tighter" style={{ color: statusPrestart }}>
              GLEICH
            </span>
          )}
          {isFinished && (
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: withAlpha(textMain, 0.35) }}>
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
          className="text-[12px] font-bold uppercase tracking-wide truncate pr-2"
          style={{ color: titleColor }}
        >
          {infusion.title}
        </h4>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{ color: durationFg, backgroundColor: durationBg }}
        >
          {infusion.duration} MIN
        </span>
      </div>
    </div>
  );
}

export function ScheduleGridSlide({ schedule, settings }: ScheduleGridSlideProps) {
  const defaults = getDefaultSettings();
  const theme = (settings.theme || defaults.theme!) as any;
  const header = settings.header || defaults.header!;

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Minute-level clock + status changes don't need 1s resolution.
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  // Preset selection (with events if autoPlay is enabled)
  const activePresetKey: PresetKey = schedule.autoPlay
    ? getActivePresetKey(settings)
    : (schedule.activePreset || getTodayPresetKey());

  const daySchedule = schedule.presets?.[activePresetKey];

  const scheduleSaunaIndexByKey = useMemo(
    () => buildScheduleSaunaIndexMap(daySchedule?.saunas || []),
    [daySchedule?.saunas]
  );

  const visibleSaunas = useMemo(() => getVisibleSaunas(settings.saunas || []), [settings.saunas]);
  const gridSaunas = useMemo(() => visibleSaunas.slice(0, 6), [visibleSaunas]);

  const accentGold = theme.accentGold || theme.accent || '#A68A64';
  const accentGreen = theme.accentGreen || theme.timeColBg || '#8F9779';
  const statusLive = theme.statusLive || '#10B981';
  const statusPrestart = theme.statusPrestart || '#F59E0B';
  const bgBase = theme.dashboardBg || theme.bg || '#FDFBF7';
  const leftBg = theme.zebra1 || '#F7F3E9';
  const border = theme.gridTable || '#EBE5D3';
  const textMain = theme.textMain || theme.fg || '#3E2723';

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

  return (
    <div
      className="w-full h-full flex font-sans select-none overflow-hidden p-8"
      style={{ backgroundColor: leftBg, color: textMain }}
    >
      <div className="w-full h-full flex flex-col overflow-hidden">
        <header className="mb-12 flex justify-between items-center z-20 w-full">
          <div className="flex items-center gap-5 min-w-0 flex-1">
            <div
              className="w-16 h-16 bg-white border rounded-2xl flex items-center justify-center shadow-md shrink-0"
              style={{ borderColor: border }}
            >
              <Waves className="w-8 h-8" style={{ color: accentGreen }} />
            </div>
            <div className="min-w-0">
              <p className="font-black uppercase tracking-[0.4em] text-[10px] mb-1 opacity-90" style={{ color: accentGreen }}>
                {header.subtitle && header.subtitle.trim() !== '' ? header.subtitle : 'Saunawelt'}
              </p>
              <h1 className="text-3xl font-black uppercase tracking-tighter leading-none whitespace-nowrap overflow-hidden text-ellipsis">
                {firstWord}{' '}
                <span style={{ color: accentGold }}>
                  {restWords}
                </span>
              </h1>
            </div>
          </div>

          <div
            className="bg-white/80 backdrop-blur-md px-7 py-4 rounded-3xl border text-right shadow-sm shrink-0 ml-4"
            style={{ borderColor: border }}
          >
            <p className="text-[11px] font-black uppercase tracking-widest mb-0.5" style={{ color: accentGold }}>
              {formatLongDateDE(now)}
            </p>
            <p className="text-4xl font-black font-mono leading-none" style={{ color: textMain }}>
              {formatClockDE(now)}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-3 grid-rows-2 gap-x-12 gap-y-14 flex-1 overflow-hidden px-2">
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
                  className={`mb-4 flex items-center justify-between border-b-2 pb-2 z-20 relative ${
                    isOutOfOrder ? 'border-red-100' : ''
                  }`}
                  style={{ borderColor: isOutOfOrder ? undefined : border }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-2 h-7 rounded-full shrink-0"
                      style={{
                        background: isOutOfOrder
                          ? 'linear-gradient(to bottom, #d6d3d1, #a8a29e)'
                          : `linear-gradient(to bottom, ${saunaAccent}, ${saunaAccent})`,
                      }}
                    />
                    <h2
                      className={`text-[18px] font-black uppercase tracking-widest leading-none truncate ${
                        isOutOfOrder ? 'text-stone-400' : ''
                      }`}
                      style={{ color: isOutOfOrder ? undefined : textMain }}
                      title={sauna.name}
                    >
                      {sauna.name}
                    </h2>
                  </div>

                  {!isOutOfOrder && sauna.info?.temperature != null && (
                    <div
                      className="flex items-center gap-1.5 font-bold text-[12px] bg-white/40 px-2.5 py-1 rounded-full border border-white/50 shrink-0"
                      style={{ color: accentGold }}
                    >
                      <Thermometer size={14} style={{ color: accentGreen }} />
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
                    itemComponent={(props) => (
                      <InfusionItemGrid
                        {...props}
                        textMain={textMain}
                        borderColor={border}
                        accentGold={accentGold}
                        statusLive={statusLive}
                        statusPrestart={statusPrestart}
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
