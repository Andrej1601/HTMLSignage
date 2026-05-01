/**
 * Medien & Speicher — vereinte Sicht auf Mediathek-Bestand und Disk-Belegung.
 *
 * Zusammengeführt aus dem ehemaligen MediaStatsWidget und der Speicher-Karte
 * im SystemChecksWidget. Zeigt:
 *   - Donut + Legende für Bestand (Bilder/Audio/Video)
 *   - Medien-Speicherbedarf (Bytes auf Disk laut Mediathek)
 *   - System-Speicher-Belegung als Bar (Belegt/Frei)
 *   - Letzte Upload-Aktivität (Name + Timestamp)
 *   - Integritäts-Hinweis bei fehlenden / verwaisten Dateien
 *
 * Reicht damit auf einen Blick: „passt der Speicher und ist die Mediathek
 * konsistent?". Die System-Speicher-Daten sind optional — wenn der
 * Runtime-Status noch nicht geladen ist, fällt der Bar-Block weg.
 */
import { Link } from 'react-router-dom';
import { Image, Music, Film, AlertTriangle, HardDrive, Clock } from 'lucide-react';
import { formatFileSize } from '@/types/media.types';
import type { Media } from '@/types/media.types';
import type { SystemRuntimeStatusResponse } from '@/services/api';
import { DashboardWidgetFrame } from '@/components/Dashboard/DashboardWidgetFrame';
import { formatRelativeTime, toValidDate } from '@/utils/dateUtils';
import clsx from 'clsx';

interface MediaStatsWidgetProps {
  images: number;
  audio: number;
  videos: number;
  totalSize: number;
  latestMedia: Media | null;
  runtimeStatus: SystemRuntimeStatusResponse | null;
}

const DONUT_SIZE = 132;
const STROKE_WIDTH = 14;
const RADIUS = (DONUT_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Segment {
  label: string;
  count: number;
  color: string;
  icon: typeof Image;
}

function getDiskTone(usagePercent: number): { bar: string; text: string; label: string } {
  if (usagePercent >= 95) return { bar: 'bg-spa-error', text: 'text-spa-error-dark', label: 'kritisch' };
  if (usagePercent >= 85) return { bar: 'bg-spa-warning', text: 'text-spa-warning-dark', label: 'fast voll' };
  return { bar: 'bg-spa-success', text: 'text-spa-success-dark', label: 'gesund' };
}

/** Belegungs-Prozentsatz auf [0, 100] clampen — die API gibt zwar
 *  normalerweise plausible Werte, aber Messfehler des OS können einen
 *  Wert > 100 liefern. Anzeige und Bar sollen dann konsistent bleiben. */
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(100, Math.max(0, value)));
}

export function MediaStatsWidget({
  images,
  audio,
  videos,
  totalSize,
  latestMedia,
  runtimeStatus,
}: MediaStatsWidgetProps) {
  const total = images + audio + videos;

  const segments: Segment[] = [
    { label: 'Bilder', count: images, color: '#3B82F6', icon: Image },
    { label: 'Audio', count: audio, color: '#8B5CF6', icon: Music },
    { label: 'Video', count: videos, color: '#10B981', icon: Film },
  ];

  // Donut-Arcs vorberechnen, damit die SVG-Strokes ohne weitere Logik
  // gerendert werden können. `dashOffset` ist negativ damit die Arcs
  // nahtlos aneinander anschließen.
  let offset = 0;
  const arcs = total > 0
    ? segments
        .filter((seg) => seg.count > 0)
        .map((seg) => {
          const pct = seg.count / total;
          const dash = pct * CIRCUMFERENCE;
          const gap = CIRCUMFERENCE - dash;
          const arc = { ...seg, dashArray: `${dash} ${gap}`, dashOffset: -offset };
          offset += dash;
          return arc;
        })
    : [];

  const disk = runtimeStatus?.disk ?? null;
  const diskTone = disk ? getDiskTone(disk.usagePercent) : null;
  const integrity = runtimeStatus?.media ?? null;
  const integrityIssues =
    integrity && (integrity.missingFiles > 0 || integrity.orphanFiles > 0)
      ? { missing: integrity.missingFiles, orphan: integrity.orphanFiles }
      : null;

  return (
    <DashboardWidgetFrame
      title="Medien & Speicher"
      description="Bestand, Speicherbedarf und Konsistenz der Mediathek."
      icon={Image}
      actions={
        <Link
          to="/media"
          className="text-xs font-semibold text-spa-primary transition-colors hover:text-spa-primary-dark"
        >
          Zur Mediathek
        </Link>
      }
    >
      <div className="space-y-5">
        {/* Donut + Legende — horizontal Layout, weniger vertikaler Platz */}
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
          {/* Donut Chart */}
          <div className="relative shrink-0">
            <svg
              width={DONUT_SIZE}
              height={DONUT_SIZE}
              viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
              role="img"
              aria-label={`Mediathek: ${total} Dateien (${images} Bilder, ${audio} Audio, ${videos} Video)`}
            >
              {/* Hintergrund-Ring */}
              <circle
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="#EDE9E3"
                strokeWidth={STROKE_WIDTH}
              />
              {arcs.map((arc) => (
                <circle
                  key={arc.label}
                  cx={DONUT_SIZE / 2}
                  cy={DONUT_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={STROKE_WIDTH}
                  strokeDasharray={arc.dashArray}
                  strokeDashoffset={arc.dashOffset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}
                  className="transition-all duration-500"
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-spa-text-primary tabular-nums leading-none">
                {total.toLocaleString('de-DE')}
              </span>
              <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-spa-text-secondary">
                Dateien
              </span>
              {totalSize > 0 && (
                <span className="mt-1 text-[10px] text-spa-text-secondary">
                  {formatFileSize(totalSize)}
                </span>
              )}
            </div>
          </div>

          {/* Legende */}
          <div className="w-full space-y-2">
            {segments.map((seg) => {
              const Icon = seg.icon;
              const pct = total > 0 ? Math.round((seg.count / total) * 100) : 0;
              return (
                <div key={seg.label} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                    aria-hidden="true"
                  />
                  <Icon className="h-3.5 w-3.5 text-spa-text-secondary shrink-0" aria-hidden="true" />
                  <span className="text-spa-text-secondary">{seg.label}</span>
                  <span className="ml-auto font-semibold text-spa-text-primary tabular-nums">
                    {seg.count}
                  </span>
                  <span className="w-10 text-right text-[11px] text-spa-text-secondary tabular-nums">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* System-Speicher — Bar mit %-Belegung */}
        {disk && diskTone ? (() => {
          const clampedPct = clampPercent(disk.usagePercent);
          return (
          <div className="rounded-xl border border-spa-bg-secondary bg-spa-bg-primary/50 p-3.5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-spa-text-secondary flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
                System-Speicher
              </p>
              <p className={clsx('text-sm font-bold tabular-nums', diskTone.text)}>
                {clampedPct}% belegt
              </p>
            </div>
            <div
              className="h-2 w-full rounded-full bg-spa-bg-secondary overflow-hidden"
              role="progressbar"
              aria-valuenow={clampedPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={`${clampedPct}% belegt — ${diskTone.label}`}
              aria-label="System-Speicher-Belegung"
            >
              <div
                className={clsx('h-full transition-all duration-500', diskTone.bar)}
                style={{ width: `${clampedPct}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-spa-text-secondary">
              <span>
                <span className="font-semibold text-spa-text-primary">
                  {formatFileSize(disk.usedBytes)}
                </span>{' '}
                belegt
              </span>
              <span>
                <span className="font-semibold text-spa-text-primary">
                  {formatFileSize(disk.availableBytes)}
                </span>{' '}
                frei
              </span>
              <span>
                Gesamt{' '}
                <span className="font-semibold text-spa-text-primary">
                  {formatFileSize(disk.totalBytes)}
                </span>
              </span>
            </div>
          </div>
          );
        })() : null}

        {/* Integritäts-Warnung — nur wenn Drift zwischen DB und Disk */}
        {integrityIssues && (
          <div className="flex items-start gap-2.5 rounded-xl border border-spa-warning/40 bg-spa-warning-light/60 px-3.5 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-spa-warning-dark mt-0.5" aria-hidden="true" />
            <div className="text-xs text-spa-warning-dark min-w-0">
              <p className="font-semibold">Mediathek nicht in Sync mit Disk</p>
              <p className="mt-0.5 leading-relaxed">
                {integrityIssues.missing > 0 && (
                  <>
                    <span className="font-semibold">{integrityIssues.missing}</span> in DB ohne Datei
                  </>
                )}
                {integrityIssues.missing > 0 && integrityIssues.orphan > 0 && ' · '}
                {integrityIssues.orphan > 0 && (
                  <>
                    <span className="font-semibold">{integrityIssues.orphan}</span> verwaiste Datei{integrityIssues.orphan === 1 ? '' : 'en'} auf Disk
                  </>
                )}
                . Housekeeping bereinigt das im nächsten Lauf.
              </p>
            </div>
          </div>
        )}

        {/* Letzter Upload — Live-Indikator für Mediathek-Aktivität */}
        {latestMedia && (
          <div className="flex items-center gap-2 text-xs text-spa-text-secondary border-t border-spa-bg-secondary pt-3">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="shrink-0">Zuletzt hochgeladen:</span>
            <span
              className="font-semibold text-spa-text-primary truncate min-w-0"
              title={latestMedia.originalName}
            >
              {latestMedia.originalName}
            </span>
            <span className="text-spa-text-secondary shrink-0">
              · {formatRelativeTime(toValidDate(latestMedia.createdAt))}
            </span>
          </div>
        )}
      </div>
    </DashboardWidgetFrame>
  );
}
