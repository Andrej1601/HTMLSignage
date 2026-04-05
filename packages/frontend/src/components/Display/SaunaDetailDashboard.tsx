import { useEffect, useMemo, useState } from 'react';
import type { Schedule, PresetKey } from '@/types/schedule.types';
import { normalizeSaunaNameKey, resolveLivePresetKey } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { getDefaultSettings } from '@/types/settings.types';
import { isEditorialDisplayAppearance } from '@/config/displayDesignStyles';
import type { Media } from '@/types/media.types';
import { Bell, Flame, Thermometer, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AutoScrollingList, type InfusionListItem } from './AutoScrollingList';
import { clampFlamesTo4, getScentEmoji, resolvePrestartMinutes, withAlpha } from './wellnessDisplayUtils';
import { getMediaUploadUrl } from '@/utils/mediaUrl';
import { buildScheduleSaunaIndexMap, resolveScheduleSaunaIndex, timeToMinutes } from './displayScheduleUtils';
import { ResilientImage } from './ResilientImage';
import { classNames } from '@/utils/classNames';
import { useDisplayViewportProfile } from '@/components/Display/useDisplayViewportProfile';

interface SaunaDetailDashboardProps {
  schedule: Schedule;
  settings: Settings;
  saunaId?: string;
  media?: Media[];
  deviceId?: string;
}

interface SaunaInfusionDetailItem extends InfusionListItem {
  title: string;
  intensity: number;
  scents: string[];
  description: string;
}

function normalizeBadgeLabel(value: string): string {
  const s = String(value ?? '').trim();
  if (!s) return s;
  const parts = s.split(/\s+/);
  // Migrate legacy format like "🌿 Eukalyptus" to "Eukalyptus".
  if (parts.length >= 2 && /^[^A-Za-z0-9ÄÖÜäöüß]+$/.test(parts[0] || '')) {
    return parts.slice(1).join(' ').trim();
  }
  return s;
}

function IntensityFlames({
  level,
  size = 12,
  activeColor,
}: {
  level: number;
  size?: number;
  activeColor: string;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4].map((i) => (
        <Flame
          key={i}
          size={size}
          className={i <= level ? 'fill-current' : ''}
          style={{
            color: i <= level ? activeColor : 'rgba(120, 113, 108, 0.35)',
          }}
        />
      ))}
    </div>
  );
}

function InfusionItemDetail({
  infusion,
  status,
  textMain,
  borderColor,
  cardBg,
  accentGold,
  accentGreen,
  statusLive,
  statusPrestart,
  aromas,
  compact = false,
  ultraCompact = false,
}: {
  infusion: SaunaInfusionDetailItem;
  status: 'ONGOING' | 'PRESTART' | 'UPCOMING' | 'FINISHED';
  textMain: string;
  borderColor: string;
  cardBg: string;
  accentGold: string;
  accentGreen: string;
  statusLive: string;
  statusPrestart: string;
  aromas?: Settings['aromas'];
  compact?: boolean;
  ultraCompact?: boolean;
}) {
  const isActive = status === 'ONGOING' || status === 'PRESTART' || status === 'UPCOMING';
  const isOngoing = status === 'ONGOING';
  const isPrestart = status === 'PRESTART';
  const isFinished = status === 'FINISHED';

  const containerBg = isOngoing
    ? withAlpha(statusLive, 0.10)
    : isPrestart
      ? withAlpha(statusPrestart, 0.10)
      : isActive
        ? withAlpha(cardBg, 0.70)
        : withAlpha(cardBg, 0.45);

  const containerBorder = isOngoing
    ? withAlpha(statusLive, 0.25)
    : isPrestart
      ? withAlpha(statusPrestart, 0.35)
      : isActive
        ? withAlpha(borderColor, 0.7)
        : withAlpha(borderColor, 0.5);

  const timeColor = isOngoing
    ? statusLive
    : isPrestart
      ? statusPrestart
      : isFinished
        ? withAlpha(textMain, 0.35)
        : textMain;

  const titleColor = isFinished ? withAlpha(textMain, 0.55) : textMain;
  const scentBg = isOngoing ? withAlpha(statusLive, 0.12) : withAlpha(accentGreen, 0.10);
  const scentBorder = isOngoing ? withAlpha(statusLive, 0.25) : withAlpha(accentGreen, 0.20);
  const scentFg = isOngoing ? withAlpha(statusLive, 0.95) : withAlpha(textMain, 0.75);
  const cardClassName = ultraCompact
    ? 'mb-2.5 min-h-[78px] p-3'
    : compact
      ? 'mb-3 min-h-[96px] p-4'
      : 'mb-5 min-h-[130px] p-5';
  const timeClassName = ultraCompact
    ? 'text-[24px] font-black font-mono leading-none'
    : compact
      ? 'text-[30px] font-black font-mono leading-none'
      : 'text-3xl font-black font-mono';
  const titleClassName = ultraCompact
    ? 'text-[12px] max-w-[170px]'
    : compact
      ? 'text-[15px] max-w-[200px]'
      : 'text-[17px] max-w-[240px]';
  const badgeClassName = ultraCompact
    ? 'gap-1 px-2 py-0.5 text-[9px]'
    : compact
      ? 'gap-1 px-2.5 py-1 text-[10px]'
      : 'gap-1.5 px-3 py-1.5 text-[11px]';
  const stateClassName = ultraCompact
    ? 'text-[8px] px-2.5 py-0.5'
    : compact
      ? 'text-[9px] px-3 py-1'
      : 'text-[10px] px-3.5 py-1.5';

  return (
    <div
      className={classNames(
        'rounded-[2rem] border transition-all flex flex-col justify-center shadow-xs relative overflow-hidden',
        ultraCompact ? 'rounded-[1.45rem]' : compact ? 'rounded-[1.7rem]' : 'rounded-[2rem]',
        cardClassName,
        isFinished && 'opacity-60',
      )}
      style={{
        backgroundColor: containerBg,
        borderColor: containerBorder,
      }}
    >
      <div className={`flex justify-between items-center ${compact ? 'mb-1.5' : 'mb-2'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={timeClassName}
            style={{ color: timeColor }}
          >
            {infusion.time}
          </span>
          <span
            className={classNames('font-black uppercase tracking-tight leading-tight truncate', titleClassName)}
            style={{ color: titleColor }}
          >
            {infusion.title}
          </span>
        </div>
        <IntensityFlames
          level={infusion.intensity}
          size={compact ? 10 : 12}
          activeColor={isOngoing ? statusLive : accentGold}
        />
      </div>

      <div className={`flex flex-wrap ${compact ? 'gap-1 mb-1.5' : 'gap-1.5 mb-2'}`}>
        {infusion.scents.map((scent, i) => (
          <div
            key={`${infusion.id}-${i}`}
            className={classNames('flex items-center rounded-full font-bold uppercase tracking-wider border shadow-xs', badgeClassName)}
            style={{
              backgroundColor: scentBg,
              borderColor: scentBorder,
              color: scentFg,
            }}
          >
            <span>{getScentEmoji(scent, aromas || [])}</span>
            <span>{scent}</span>
          </div>
        ))}
      </div>

      {!compact && infusion.description ? (
        <p
          className="text-[13px] leading-tight italic line-clamp-2 px-1 pr-20"
          style={{ color: withAlpha(textMain, 0.7) }}
        >
          {infusion.description}
        </p>
      ) : null}

      {(isOngoing || isPrestart) && (
        <div className={`absolute flex items-center ${compact ? 'bottom-3 right-4' : 'bottom-4 right-5'}`}>
          {isOngoing ? (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className={classNames('font-black tracking-[0.15em] rounded-full shadow-xs border', stateClassName)}
              style={{
                color: statusLive,
                backgroundColor: withAlpha(statusLive, 0.18),
                borderColor: withAlpha(statusLive, 0.28),
              }}
            >
              LÄUFT
            </motion.span>
          ) : (
            <span
              className={classNames('font-black tracking-[0.15em] rounded-full shadow-xs border', stateClassName)}
              style={{
                color: statusPrestart,
                backgroundColor: withAlpha(statusPrestart, 0.18),
                borderColor: withAlpha(statusPrestart, 0.28),
              }}
            >
              GLEICH
            </span>
          )}
        </div>
      )}

      {isFinished && (
        <div className={`absolute flex items-center ${compact ? 'bottom-3 right-4' : 'bottom-4 right-5'}`}>
          <span
            className={classNames('font-black tracking-[0.15em] rounded-full shadow-xs border', stateClassName)}
            style={{
              color: withAlpha(textMain, 0.55),
              backgroundColor: withAlpha(borderColor, 0.18),
              borderColor: withAlpha(borderColor, 0.28),
            }}
          >
            VORBEI
          </span>
        </div>
      )}
    </div>
  );
}

export function SaunaDetailDashboard({ schedule, settings, saunaId, media: mediaProp, deviceId }: SaunaDetailDashboardProps) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;
  const media = mediaProp;

  const [now, setNow] = useState(() => new Date());
  const { containerRef, profile } = useDisplayViewportProfile<HTMLDivElement>();
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  const sauna = useMemo(() => {
    if (!saunaId) return undefined;
    const list = settings.saunas || [];
    return (
      list.find((s) => s.id === saunaId) ||
      list.find((s) => s.name === saunaId) ||
      list.find((s) => normalizeSaunaNameKey(s.name) === normalizeSaunaNameKey(saunaId))
    );
  }, [settings.saunas, saunaId]);

  const activePresetKey: PresetKey = resolveLivePresetKey(schedule, settings, now, deviceId);

  const daySchedule = schedule.presets?.[activePresetKey];
  const scheduleSaunaIndexByKey = useMemo(
    () => buildScheduleSaunaIndexMap(daySchedule?.saunas || []),
    [daySchedule?.saunas]
  );

  const accentGold = theme.accentGold || theme.accent || '#A68A64';
  const accentGreen = theme.accentGreen || theme.timeColBg || '#8F9779';
  const bgRight = theme.zebra2 || '#F2EDE1';
  const textMain = theme.textMain || theme.fg || '#3E2723';
  const statusLive = theme.statusLive || '#10B981';
  const statusPrestart = theme.statusPrestart || '#F59E0B';
  const cardBg = theme.cardBg || theme.cellBg || '#FFFFFF';
  const cardBorder = theme.cardBorder || theme.gridTable || '#EBE5D3';
  const prestartMinutes = resolvePrestartMinutes(settings);
  const isEditorial = isEditorialDisplayAppearance(settings.displayAppearance);

  const saunaImageUrl = useMemo(() => {
    if (!sauna?.imageId) return null;
    return getMediaUploadUrl(media, sauna.imageId);
  }, [media, sauna?.imageId]);

  const infusions: SaunaInfusionDetailItem[] = useMemo(() => {
    if (!sauna || !daySchedule?.rows || !daySchedule.saunas) return [];
    const saunaIndex = resolveScheduleSaunaIndex(daySchedule.saunas, sauna.name, scheduleSaunaIndexByKey);
    if (saunaIndex < 0) return [];

    return daySchedule.rows
      .map((row) => {
        const entry = row.entries?.[saunaIndex];
        if (!entry?.title) return null;
        return {
          id: `${activePresetKey}-${sauna.id}-${row.time}`,
          time: row.time,
          duration: entry.duration ?? 15,
          title: entry.title,
          intensity: clampFlamesTo4(entry.flames ?? 1),
          scents: (entry.badges || []).map(normalizeBadgeLabel).filter(Boolean),
          description: entry.description || entry.subtitle || '',
        };
      })
      .filter(Boolean) as SaunaInfusionDetailItem[];
  }, [activePresetKey, daySchedule?.rows, daySchedule?.saunas, sauna, scheduleSaunaIndexByKey]);

  const sortedInfusions = useMemo(() => {
    return infusions.slice().sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  }, [infusions]);

  const infoBadges = useMemo(() => {
    if (!sauna) return [];
    const raw = String(sauna.description || '');
    return raw
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 2);
  }, [sauna]);
  const isCompactLayout = profile.isCompact || profile.isNarrow;
  const isUltraCompactLayout = profile.isUltraCompact || profile.isShort;
  const visibleInfoBadges = isUltraCompactLayout ? infoBadges.slice(0, 1) : infoBadges;

  if (!sauna) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center" style={{ backgroundColor: bgRight, color: textMain }}>
        <p className="text-lg opacity-70">Keine Sauna ausgewählt</p>
      </div>
    );
  }

  if (isEditorial) {
    const titleOverlayColor = withAlpha('#1F1711', 0.62);
    const titleTextColor = '#FFF7EA';

      return (
      <div ref={containerRef} className="relative h-full w-full overflow-hidden" style={{ backgroundColor: bgRight, color: textMain }}>
        {saunaImageUrl ? (
          <>
            <ResilientImage
              src={saunaImageUrl}
              className="absolute inset-0 h-full w-full object-cover"
              alt={sauna.name}
              fallback={<div className="absolute inset-0" style={{ backgroundColor: withAlpha(accentGreen, 0.12) }} />}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${withAlpha('#0F0B08', 0.72)} 0%, ${withAlpha('#221811', 0.58)} 18%, ${withAlpha(bgRight, 0.3)} 34%, ${withAlpha(bgRight, 0.88)} 56%, ${bgRight} 100%)`,
              }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${withAlpha(accentGreen, 0.18)} 0%, ${withAlpha(cardBg, 0.32)} 38%, ${bgRight} 100%)`,
            }}
          />
        )}

        <div className={classNames('relative z-10 flex h-full flex-col', isUltraCompactLayout ? 'p-3' : isCompactLayout ? 'p-4' : 'p-6')}>
          <div className="shrink-0 px-1">
            <div className="flex items-start justify-between gap-4">
              <div
                className={classNames(
                  'min-w-0 border backdrop-blur-xl',
                  isUltraCompactLayout ? 'rounded-[1.15rem] px-3 py-2.5' : isCompactLayout ? 'rounded-[1.4rem] px-4 py-3' : 'rounded-[1.75rem] px-5 py-4',
                )}
                style={{
                  borderColor: withAlpha('#FFFFFF', 0.14),
                  backgroundColor: titleOverlayColor,
                  boxShadow: `0 18px 42px ${withAlpha('#120D09', 0.24)}`,
                }}
              >
                <h2
                  className={classNames(
                    'font-black uppercase tracking-tighter leading-[0.92] [text-wrap:balance]',
                    isUltraCompactLayout ? 'text-[1.45rem]' : isCompactLayout ? 'text-[1.9rem]' : 'text-[2.55rem]',
                  )}
                  style={{
                    color: titleTextColor,
                    textShadow: `0 4px 18px ${withAlpha('#000000', 0.26)}`,
                  }}
                >
                  {sauna.name}
                </h2>
                {visibleInfoBadges.length > 0 && (
                  <div className={classNames(isCompactLayout ? 'mt-2 flex flex-wrap gap-1.5' : 'mt-3 flex flex-wrap gap-2')}>
                    {visibleInfoBadges.map((text, idx) => (
                      <div
                        key={`${sauna.id}-info-${idx}`}
                        className={classNames(
                          'inline-flex max-w-full items-center rounded-full border font-bold tracking-wide',
                          isUltraCompactLayout ? 'gap-1.5 px-2.5 py-1 text-[9px]' : isCompactLayout ? 'gap-2 px-3 py-1 text-[10px]' : 'gap-2 px-3.5 py-1.5 text-[11px]',
                        )}
                        style={{
                          color: titleTextColor,
                          borderColor: withAlpha('#FFFFFF', 0.16),
                          backgroundColor: withAlpha('#FFF8F0', 0.12),
                        }}
                      >
                        <Bell className="h-3.5 w-3.5 shrink-0" style={{ color: withAlpha('#F6E5C8', 0.92) }} />
                        <span className="truncate">{text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 shrink-0">
                {sauna.info?.temperature != null && (
                  <div
                    className={classNames(
                      'inline-flex items-center gap-1.5 rounded-full border font-semibold',
                      isUltraCompactLayout ? 'px-2 py-1 text-[9px]' : isCompactLayout ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]',
                    )}
                    style={{
                      color: textMain,
                      borderColor: withAlpha(cardBorder, 0.55),
                      backgroundColor: withAlpha(cardBg, 0.72),
                    }}
                  >
                    <Thermometer className="h-3.5 w-3.5" style={{ color: accentGreen }} />
                    {sauna.info.temperature}°C
                  </div>
                )}
                {sauna.info?.capacity != null && (
                  <div
                    className={classNames(
                      'inline-flex items-center gap-1.5 rounded-full border font-semibold',
                      isUltraCompactLayout ? 'px-2 py-1 text-[9px]' : isCompactLayout ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]',
                    )}
                    style={{
                      color: textMain,
                      borderColor: withAlpha(cardBorder, 0.55),
                      backgroundColor: withAlpha(cardBg, 0.72),
                    }}
                  >
                    <Users className="h-3.5 w-3.5" style={{ color: accentGreen }} />
                    {sauna.info.capacity} Pers.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            className={classNames(
              'mt-4 flex flex-1 min-h-0 flex-col overflow-hidden border backdrop-blur-md',
              isUltraCompactLayout ? 'rounded-[1.35rem] p-3' : isCompactLayout ? 'rounded-[1.7rem] p-4' : 'rounded-[2.15rem] p-5',
            )}
            style={{
              backgroundColor: withAlpha(cardBg, 0.78),
              borderColor: withAlpha(cardBorder, 0.95),
            }}
          >
            <h4
              className={classNames(
                'flex shrink-0 items-center font-black uppercase',
                isCompactLayout ? 'mb-2 gap-2.5 text-[9px] tracking-[0.22em]' : 'mb-3 gap-4 text-[11px] tracking-[0.4em]',
              )}
              style={{ color: accentGreen }}
            >
              <div className={classNames('rounded-full opacity-40', isCompactLayout ? 'h-0.5 w-5' : 'h-0.5 w-8')} style={{ backgroundColor: accentGreen }} />
              Programm
            </h4>

            <div className="min-h-0 flex-1 overflow-hidden">
              {sortedInfusions.length === 0 ? (
                <p className="py-4 text-center text-sm opacity-70">Keine Aufgüsse geplant</p>
              ) : (
                <AutoScrollingList
                  items={sortedInfusions}
                  now={now}
                  isDetail={true}
                  prestartMinutes={prestartMinutes}
                  itemComponent={({ infusion, status }) => (
                    <InfusionItemDetail
                      infusion={infusion}
                      status={status}
                      textMain={textMain}
                      borderColor={cardBorder}
                      cardBg={cardBg}
                      accentGold={accentGold}
                      accentGreen={accentGreen}
                      statusLive={statusLive}
                      statusPrestart={statusPrestart}
                      aromas={settings.aromas}
                      compact
                      ultraCompact={isCompactLayout}
                    />
                  )}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={classNames('w-full h-full flex flex-col', isUltraCompactLayout ? 'p-4' : isCompactLayout ? 'p-5' : 'p-8')}
      style={{ backgroundColor: bgRight, color: textMain }}
    >
      <div className={classNames('relative w-full overflow-hidden shadow-lg shrink-0 border-4 border-white', isUltraCompactLayout ? 'mb-3 h-20 rounded-[1.4rem]' : isCompactLayout ? 'mb-3 h-24 rounded-[1.6rem]' : 'mb-4 h-28 rounded-[2rem]')}>
        <ResilientImage
          src={saunaImageUrl}
          className="w-full h-full object-cover"
          alt={sauna.name}
          fallback={
            <div
              className="w-full h-full flex items-center justify-center text-sm font-semibold uppercase tracking-[0.2em]"
              style={{ backgroundColor: withAlpha(accentGreen, 0.18), color: accentGold }}
            >
              Sauna
            </div>
          }
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${withAlpha(bgRight, 0.4)} 0%, rgba(0,0,0,0) 60%)`,
          }}
        />
      </div>

      <div className={classNames('flex items-center px-1', isCompactLayout ? 'mb-1.5 gap-2' : 'mb-2 gap-3')}>
        <span
          className={classNames(
            'text-white font-black rounded-full uppercase shadow-xs shrink-0',
            isUltraCompactLayout ? 'px-2.5 py-1 text-[8px] tracking-[0.16em]' : isCompactLayout ? 'px-3 py-1 text-[9px] tracking-[0.18em]' : 'px-3.5 py-1.5 text-[10px] tracking-widest',
          )}
          style={{ backgroundColor: accentGreen }}
        >
          Portrait
        </span>
        <div
          className={classNames(
            'flex items-center font-bold bg-white/40 rounded-full border border-white/60',
            isUltraCompactLayout ? 'gap-2 px-2.5 py-1 text-[10px]' : isCompactLayout ? 'gap-2.5 px-3 py-1 text-[11px]' : 'gap-3 px-3.5 py-1.5 text-[13px]',
          )}
          style={{ color: accentGold }}
        >
          {sauna.info?.temperature != null && (
            <span className="flex items-center gap-1.5 shrink-0">
              <Thermometer size={16} style={{ color: accentGreen }} /> {sauna.info.temperature}°C
            </span>
          )}
          {sauna.info?.capacity != null && (
            <span className="flex items-center gap-1.5 shrink-0">
              <Users size={16} style={{ color: accentGreen }} /> {sauna.info.capacity} Pers.
            </span>
          )}
        </div>
      </div>

      <h2
        className={classNames(
          'font-black uppercase tracking-tighter leading-none px-1',
          isUltraCompactLayout ? 'mb-2 text-[2rem]' : isCompactLayout ? 'mb-3 text-[2.6rem]' : 'mb-4 text-5xl',
        )}
        style={{ color: textMain }}
      >
        {sauna.name}
      </h2>

      <AnimatePresence>
        {visibleInfoBadges.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: 'auto', opacity: 1, marginBottom: 8 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className={classNames('flex flex-col', isCompactLayout ? 'gap-1.5' : 'gap-2')}>
              {visibleInfoBadges.map((text, idx) => (
                <div
                  key={`${sauna.id}-info-${idx}`}
                  className={classNames(
                    'text-white rounded-3xl flex items-center shadow-xs border border-white/20',
                    isUltraCompactLayout ? 'gap-2 p-2.5 px-3.5' : isCompactLayout ? 'gap-2.5 p-3 px-4' : 'gap-3 p-3 px-5',
                  )}
                  style={{ backgroundColor: accentGreen }}
                >
                  {idx === 0 ? (
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center shrink-0 shadow-inner"
                    >
                      <Bell className="w-5 h-5" />
                    </motion.div>
                  ) : (
                    <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center shrink-0 shadow-inner">
                      <Bell className="w-5 h-5" />
                    </div>
                  )}
                  <p className={classNames(isCompactLayout ? 'text-[11px]' : 'text-[13px]', 'font-black uppercase tracking-tight leading-snug italic')}>
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={classNames(
          'flex-1 border-2 backdrop-blur-md flex flex-col min-h-0 shadow-xs overflow-hidden',
          isUltraCompactLayout ? 'rounded-[1.5rem] p-4' : isCompactLayout ? 'rounded-[2rem] p-5' : 'rounded-[2.5rem] p-8',
        )}
        style={{
          backgroundColor: withAlpha(cardBg, 0.65),
          borderColor: withAlpha(cardBorder, 1),
        }}
      >
        <h4
          className={classNames(
            'font-black uppercase flex items-center shrink-0',
            isCompactLayout ? 'mb-2.5 gap-2.5 text-[9px] tracking-[0.2em]' : 'mb-4 gap-4 text-[11px] tracking-[0.4em]',
          )}
          style={{ color: accentGreen }}
        >
          <div className={classNames('h-0.5 rounded-full opacity-40', isCompactLayout ? 'w-5' : 'w-8')} style={{ backgroundColor: accentGreen }} />
          Programm
        </h4>

        <div className="flex-1 overflow-hidden">
          {sortedInfusions.length === 0 ? (
            <p className="text-sm opacity-70 text-center py-4">Keine Aufgüsse geplant</p>
          ) : (
            <AutoScrollingList
              items={sortedInfusions}
              now={now}
              isDetail={true}
              prestartMinutes={prestartMinutes}
              itemComponent={({ infusion, status }) => (
                <InfusionItemDetail
                  infusion={infusion}
                  status={status}
                  textMain={textMain}
                  borderColor={cardBorder}
                  cardBg={cardBg}
                  accentGold={accentGold}
                  accentGreen={accentGreen}
                  statusLive={statusLive}
                  statusPrestart={statusPrestart}
                  aromas={settings.aromas}
                  compact={isCompactLayout}
                  ultraCompact={isUltraCompactLayout}
                />
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}
