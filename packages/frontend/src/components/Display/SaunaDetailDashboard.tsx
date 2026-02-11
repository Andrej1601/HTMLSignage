import { useEffect, useMemo, useState } from 'react';
import type { Schedule, PresetKey } from '@/types/schedule.types';
import { getActivePresetKey, getTodayPresetKey, normalizeSaunaNameKey } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { getDefaultSettings } from '@/types/settings.types';
import { useMedia } from '@/hooks/useMedia';
import type { Media } from '@/types/media.types';
import { Bell, Flame, Thermometer, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AutoScrollingList, type InfusionListItem } from './AutoScrollingList';
import { clampFlamesTo4, getScentEmoji, withAlpha } from './wellnessDisplayUtils';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

interface SaunaDetailDashboardProps {
  schedule: Schedule;
  settings: Settings;
  saunaId?: string;
}

interface SaunaInfusionDetailItem extends InfusionListItem {
  title: string;
  intensity: number;
  scents: string[];
  description: string;
}

function timeToMinutes(timeStr: string): number {
  const [hRaw, mRaw] = String(timeStr ?? '').split(':');
  const h = parseInt(hRaw || '', 10);
  const m = parseInt(mRaw || '', 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.POSITIVE_INFINITY;
  return h * 60 + m;
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

  return (
    <div
      className={`p-5 rounded-[2rem] border transition-all mb-5 min-h-[130px] flex flex-col justify-center shadow-sm relative overflow-hidden ${isFinished ? 'opacity-60' : ''}`}
      style={{
        backgroundColor: containerBg,
        borderColor: containerBorder,
      }}
    >
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-3xl font-black font-mono"
            style={{ color: timeColor }}
          >
            {infusion.time}
          </span>
          <span
            className="font-black text-[17px] uppercase tracking-tight leading-tight truncate max-w-[240px]"
            style={{ color: titleColor }}
          >
            {infusion.title}
          </span>
        </div>
        <IntensityFlames level={infusion.intensity} activeColor={isOngoing ? statusLive : accentGold} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {infusion.scents.map((scent, i) => (
          <div
            key={`${infusion.id}-${i}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border shadow-sm"
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

      <p
        className="text-[13px] leading-tight italic line-clamp-2 px-1 pr-20"
        style={{ color: withAlpha(textMain, 0.7) }}
      >
        {infusion.description}
      </p>

      {(isOngoing || isPrestart) && (
        <div className="absolute bottom-4 right-5 flex items-center">
          {isOngoing ? (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-[10px] font-black tracking-[0.15em] px-3.5 py-1.5 rounded-full shadow-sm border"
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
              className="text-[10px] font-black tracking-[0.15em] px-3.5 py-1.5 rounded-full shadow-sm border"
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
        <div className="absolute bottom-4 right-5 flex items-center">
          <span
            className="text-[10px] font-black tracking-[0.15em] px-3.5 py-1.5 rounded-full shadow-sm border"
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

export function SaunaDetailDashboard({ schedule, settings, saunaId }: SaunaDetailDashboardProps) {
  const defaults = getDefaultSettings();
  const theme = (settings.theme || defaults.theme!) as any;
  const { data: media } = useMedia();

  const [now, setNow] = useState(() => new Date());
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

  // Preset selection (with events if autoPlay is enabled)
  const activePresetKey: PresetKey = schedule.autoPlay
    ? getActivePresetKey(settings)
    : (schedule.activePreset || getTodayPresetKey());

  const daySchedule = schedule.presets?.[activePresetKey];

  const accentGold = theme.accentGold || theme.accent || '#A68A64';
  const accentGreen = theme.accentGreen || theme.timeColBg || '#8F9779';
  const bgRight = theme.zebra2 || '#F2EDE1';
  const textMain = theme.textMain || theme.fg || '#3E2723';
  const statusLive = theme.statusLive || '#10B981';
  const statusPrestart = theme.statusPrestart || '#F59E0B';
  const cardBg = theme.cardBg || theme.cellBg || '#FFFFFF';
  const cardBorder = theme.cardBorder || theme.gridTable || '#EBE5D3';

  const saunaImageUrl = useMemo(() => {
    if (!sauna?.imageId) return null;
    const item = (media || []).find((m: Media) => m.id === sauna.imageId);
    if (!item) return null;
    return `${API_URL}/uploads/${item.filename}`;
  }, [media, sauna?.imageId]);

  const fallbackImage =
    'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&q=80&w=1200';

  const infusions: SaunaInfusionDetailItem[] = useMemo(() => {
    if (!sauna || !daySchedule?.rows || !daySchedule.saunas) return [];
    let saunaIndex = daySchedule.saunas.indexOf(sauna.name);
    if (saunaIndex < 0) {
      const key = normalizeSaunaNameKey(sauna.name);
      saunaIndex = daySchedule.saunas.findIndex((n) => normalizeSaunaNameKey(n) === key);
    }
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
  }, [activePresetKey, daySchedule?.rows, daySchedule?.saunas, sauna]);

  const sortedInfusions = useMemo(() => {
    return infusions.slice().sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  }, [infusions]);

  const infoBadges = useMemo(() => {
    if (!sauna) return [];
    const raw = String((sauna as any).notice || sauna.description || '');
    return raw
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 2);
  }, [sauna]);

  if (!sauna) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: bgRight, color: textMain }}>
        <p className="text-lg opacity-70">Keine Sauna ausgewählt</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-8 flex flex-col" style={{ backgroundColor: bgRight, color: textMain }}>
      <div className="relative h-28 w-full rounded-[2rem] overflow-hidden mb-4 shadow-lg shrink-0 border-4 border-white">
        <img src={saunaImageUrl || fallbackImage} className="w-full h-full object-cover" alt={sauna.name} />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${withAlpha(bgRight, 0.4)} 0%, rgba(0,0,0,0) 60%)`,
          }}
        />
      </div>

      <div className="flex items-center gap-3 mb-2 px-1">
        <span
          className="text-white text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-widest shadow-sm shrink-0"
          style={{ backgroundColor: accentGreen }}
        >
          Portrait
        </span>
        <div
          className="flex items-center gap-3 text-[13px] font-bold bg-white/40 px-3.5 py-1.5 rounded-full border border-white/60"
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

      <h2 className="text-5xl font-black uppercase tracking-tighter mb-4 leading-none px-1" style={{ color: textMain }}>
        {sauna.name}
      </h2>

      <AnimatePresence>
        {infoBadges.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: 'auto', opacity: 1, marginBottom: 8 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="flex flex-col gap-2">
              {infoBadges.map((text, idx) => (
                <div
                  key={`${sauna.id}-info-${idx}`}
                  className="text-white p-3 px-5 rounded-3xl flex items-center gap-3 shadow-sm border border-white/20"
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
                  <p className="text-[13px] font-black uppercase tracking-tight leading-snug italic">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="flex-1 border-2 rounded-[2.5rem] p-8 backdrop-blur-md flex flex-col min-h-0 shadow-sm overflow-hidden"
        style={{
          backgroundColor: withAlpha(cardBg, 0.65),
          borderColor: withAlpha(cardBorder, 1),
        }}
      >
        <h4 className="font-black uppercase text-[11px] tracking-[0.4em] mb-4 flex items-center gap-4 shrink-0" style={{ color: accentGreen }}>
          <div className="w-8 h-0.5 rounded-full opacity-40" style={{ backgroundColor: accentGreen }} />
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
                />
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}
