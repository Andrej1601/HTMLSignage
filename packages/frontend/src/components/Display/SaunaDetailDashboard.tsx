import { useEffect, useRef } from 'react';
import type { Schedule, PresetKey } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { getTodayPresetKey } from '@/types/schedule.types';
import { getDefaultSettings } from '@/types/settings.types';
import { Flame, Thermometer, Users, Info } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface SaunaDetailDashboardProps {
  schedule: Schedule;
  settings: Settings;
  saunaId?: string;
}

interface IntensityIconProps {
  level: number;
  isActive: boolean;
  isNext: boolean;
  theme: any;
}

function IntensityIcon({ level, isActive, isNext, theme }: IntensityIconProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <Flame
            key={i}
            size={14}
            className={i <= level ? 'fill-current' : ''}
            style={{
              color: i <= level ? theme.accentGold || theme.flame : theme.cardBorder || theme.gridTable,
            }}
          />
        ))}
      </div>
      {isActive && (
        <div
          className="text-[7px] font-black px-1 py-0.5 rounded-sm uppercase tracking-tighter leading-none mt-0.5 text-white"
          style={{ backgroundColor: theme.statusLive || '#10B981' }}
        >
          Läuft
        </div>
      )}
      {isNext && !isActive && (
        <div
          className="text-[7px] font-black px-1 py-0.5 rounded-sm uppercase tracking-tighter leading-none mt-0.5 text-white"
          style={{ backgroundColor: theme.statusNext || theme.accentGold || theme.accent }}
        >
          Nächster
        </div>
      )}
    </div>
  );
}

interface ScentsBadgesProps {
  scents: string[];
  theme: any;
}

function ScentsBadges({ scents, theme }: ScentsBadgesProps) {
  if (!scents || scents.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Info size={12} className="shrink-0" style={{ color: theme.accentGreen || theme.accentGold }} />
      <span className="text-[10px] font-bold uppercase tracking-widest leading-none" style={{ color: theme.textMuted || theme.fg }}>
        {scents.join(' • ')}
      </span>
    </div>
  );
}

export function SaunaDetailDashboard({ schedule, settings, saunaId }: SaunaDetailDashboardProps) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Find the sauna
  const sauna = settings.saunas?.find((s) => s.id === saunaId);

  // Determine which preset to show
  const activePresetKey: PresetKey = schedule.autoPlay
    ? getTodayPresetKey()
    : (schedule.activePreset || getTodayPresetKey());

  const daySchedule = schedule.presets?.[activePresetKey];

  // Debug logging
  console.log('[SaunaDetailDashboard] Debug:', {
    saunaId,
    sauna: sauna?.name,
    activePresetKey,
    hasDaySchedule: !!daySchedule,
    saunasInSchedule: daySchedule?.saunas,
    rowCount: daySchedule?.rows?.length,
  });

  // Extract sessions for this sauna
  const saunaIndex = daySchedule?.saunas?.findIndex((s) => s === sauna?.name);
  const sessions: any[] = [];

  if (daySchedule && saunaIndex !== undefined && saunaIndex !== -1) {
    const now = new Date();
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

    daySchedule.rows.forEach((row) => {
      const entry = row.entries?.[saunaIndex];
      if (entry?.title) {
        const [hours, minutes] = row.time.split(':').map(Number);
        const rowTimeMinutes = hours * 60 + minutes;
        const sessionDuration = 60;

        const isActive =
          currentTimeMinutes >= rowTimeMinutes &&
          currentTimeMinutes < rowTimeMinutes + sessionDuration;
        const isNext = rowTimeMinutes > currentTimeMinutes && sessions.filter((s) => s.isNext).length === 0;

        // Parse flames to number
        const flames = typeof entry.flames === 'number'
          ? entry.flames
          : parseInt(String(entry.flames || '1'), 10) || 1;

        sessions.push({
          time: row.time,
          title: entry.title,
          subtitle: entry.subtitle || '',
          intensity: flames,
          scents: entry.badges || [],
          isActive,
          isNext,
        });
      }
    });
  }

  // Auto-scroll effect
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || sessions.length <= 6) return; // Only scroll if more than 6 items

    let scrollPos = 0;
    const scrollMax = el.scrollHeight - el.clientHeight;

    if (scrollMax <= 0) return;

    const scrollInterval = setInterval(() => {
      scrollPos += 0.5;
      if (scrollPos >= scrollMax + 50) scrollPos = -50;
      el.scrollTop = scrollPos;
    }, 50);

    return () => clearInterval(scrollInterval);
  }, [sessions.length]);

  if (!sauna) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{
          backgroundColor: theme.dashboardBg || theme.bg,
          color: theme.textMain || theme.fg,
        }}
      >
        <p className="text-lg opacity-70">Keine Sauna ausgewählt</p>
      </div>
    );
  }

  // Get sauna image (if available)
  // Note: imageId would need to be resolved to actual URL in a real app
  const saunaImage = 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&q=80&w=1200';

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden p-10"
      style={{
        backgroundColor: theme.dashboardBg || theme.bg,
        color: theme.textMain || theme.fg,
      }}
    >
      {/* Sauna Image with modern rounded corners */}
      <div className="relative h-36 w-full rounded-[2.5rem] overflow-hidden mb-6 shadow-xl shrink-0 border-[6px]" style={{ borderColor: theme.cardBg || '#FFFFFF' }}>
        <img src={saunaImage} className="w-full h-full object-cover scale-105" alt={sauna.name} />
        <div className="absolute inset-0 bg-gradient-to-t from-current/60 via-transparent to-transparent" style={{ color: theme.dashboardBg || theme.bg }} />
      </div>

      {/* Modern Badge Row */}
      <div className="flex items-center gap-3 mb-3 px-2">
        <span
          className="text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm"
          style={{
            backgroundColor: theme.accentGreen || theme.accentGold || theme.accent,
            color: theme.cardBg || '#FFFFFF',
          }}
        >
          Sauna Portrait
        </span>
        <div
          className="flex items-center gap-4 text-sm font-bold px-4 py-1.5 rounded-full border backdrop-blur-sm"
          style={{
            backgroundColor: `${theme.cardBg || '#FFFFFF'}40`,
            borderColor: `${theme.cardBg || '#FFFFFF'}60`,
            color: theme.accentGold || theme.accent,
          }}
        >
          {sauna.info?.temperature && (
            <span className="flex items-center gap-1.5">
              <Thermometer size={16} style={{ color: theme.accentGreen || theme.accentGold }} /> {sauna.info.temperature}°C
            </span>
          )}
          {sauna.info?.capacity && (
            <span className="flex items-center gap-1.5">
              <Users size={16} style={{ color: theme.accentGreen || theme.accentGold }} /> {sauna.info.capacity} Pers.
            </span>
          )}
        </div>
      </div>

      {/* Sauna Name */}
      <h2 className="text-5xl font-black uppercase tracking-tighter mb-6 leading-none px-2" style={{ color: theme.textMain || theme.fg }}>
        {sauna.name}
      </h2>

      {/* Modern Glassmorphism Card for Program */}
      <div
        className="flex-1 border-2 rounded-[3rem] p-8 backdrop-blur-md flex flex-col min-h-0 shadow-sm overflow-hidden"
        style={{
          backgroundColor: `${theme.cardBg || '#FFFFFF'}60`,
          borderColor: theme.cardBg || '#FFFFFF',
        }}
      >
        <h4
          className="font-black uppercase text-[11px] tracking-[0.4em] mb-5 flex items-center gap-4 shrink-0"
          style={{ color: theme.accentGreen || theme.accentGold }}
        >
          <div className="w-10 h-0.5 rounded-full opacity-40" style={{ backgroundColor: theme.accentGreen || theme.accentGold }} />
          Aufgussplan
        </h4>

        <div className="flex-1 overflow-hidden">
          <div ref={scrollRef} className="h-full space-y-3 overflow-hidden scroll-smooth scrollbar-hide">
            {sessions.length === 0 ? (
              <p className="text-sm opacity-70 text-center py-4">Keine Aufgüsse geplant</p>
            ) : (
              sessions.map((session, idx) => {
                const statusBadge = session.isActive ? 'ongoing' : session.isNext ? 'next' : null;

                return (
                  <div
                    key={idx}
                    className="p-4 rounded-3xl border transition-all mb-3 h-[104px] flex flex-col justify-center shadow-sm backdrop-blur-sm"
                    style={{
                      backgroundColor: session.isActive
                        ? `${theme.statusLive || '#10B981'}10`
                        : session.isNext
                        ? `${theme.statusNext || theme.accentGold}10`
                        : `${theme.cardBg || '#FFFFFF'}60`,
                      borderColor: session.isActive
                        ? `${theme.statusLive || '#10B981'}20`
                        : session.isNext
                        ? `${theme.statusNext || theme.accentGold}20`
                        : `${theme.cardBorder || theme.gridTable}`,
                    }}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-3">
                        <span
                          className="text-2xl font-black font-mono"
                          style={{
                            color: session.isActive
                              ? theme.statusLive || '#10B981'
                              : session.isNext
                              ? theme.statusNext || theme.accentGold
                              : theme.textMain || theme.fg,
                          }}
                        >
                          {session.time}
                        </span>
                        {statusBadge && <StatusBadge status={statusBadge} theme={theme} size="md" />}
                        <span
                          className="font-black text-sm uppercase tracking-tight leading-tight truncate max-w-[140px]"
                          style={{ color: theme.textMain || theme.fg }}
                        >
                          {session.title}
                        </span>
                      </div>
                      <IntensityIcon
                        level={session.intensity}
                        isActive={session.isActive}
                        isNext={session.isNext}
                        theme={theme}
                      />
                    </div>
                    <ScentsBadges scents={session.scents} theme={theme} />
                    {session.subtitle && (
                      <p
                        className="text-[11px] leading-normal italic line-clamp-2 mt-1.5"
                        style={{ color: theme.textMuted || theme.fg }}
                      >
                        {session.subtitle}
                      </p>
                    )}
                  </div>
                );
              })
            )}
            <div className="h-16" />
          </div>
        </div>
      </div>
    </div>
  );
}
