import { Link } from 'react-router-dom';
import { Image, Music, Film } from 'lucide-react';
import { formatFileSize } from '@/types/media.types';
import { DashboardWidgetFrame } from '@/components/Dashboard/DashboardWidgetFrame';

interface MediaStatsWidgetProps {
  images: number;
  audio: number;
  videos: number;
  totalSize: number;
}

const DONUT_SIZE = 120;
const STROKE_WIDTH = 14;
const RADIUS = (DONUT_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Segment {
  label: string;
  count: number;
  color: string;
  icon: typeof Image;
}

export function MediaStatsWidget({ images, audio, videos, totalSize }: MediaStatsWidgetProps) {
  const total = images + audio + videos;

  const segments: Segment[] = [
    { label: 'Bilder', count: images, color: '#3B82F6', icon: Image },
    { label: 'Audio', count: audio, color: '#8B5CF6', icon: Music },
    { label: 'Video', count: videos, color: '#10B981', icon: Film },
  ];

  // Build donut arcs
  let offset = 0;
  const arcs = total > 0
    ? segments.map((seg) => {
        const pct = seg.count / total;
        const dash = pct * CIRCUMFERENCE;
        const gap = CIRCUMFERENCE - dash;
        const arc = { ...seg, dashArray: `${dash} ${gap}`, dashOffset: -offset };
        offset += dash;
        return arc;
      })
    : [];

  return (
    <DashboardWidgetFrame
      title="Medien-Statistiken"
      description="Bestand und Verteilung der Medien-Assets."
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
      <div className="flex flex-col items-center gap-6">
        {/* Donut Chart */}
        <div className="relative">
          <svg width={DONUT_SIZE} height={DONUT_SIZE} viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}>
            {total === 0 ? (
              <circle
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="#EDE9E3"
                strokeWidth={STROKE_WIDTH}
              />
            ) : (
              arcs.map((arc) => (
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
              ))
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-spa-text-primary">{total.toLocaleString('de-DE')}</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-spa-text-secondary">Dateien</span>
          </div>
        </div>

        {/* Legend + Stats */}
        <div className="w-full space-y-2">
          {segments.map((seg) => {
            const Icon = seg.icon;
            return (
              <div key={seg.label} className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 text-spa-text-secondary">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                  <Icon className="h-3.5 w-3.5" />
                  {seg.label}
                </span>
                <span className="font-semibold text-spa-text-primary">{seg.count}</span>
              </div>
            );
          })}
          <div className="flex items-center justify-between border-t border-spa-bg-secondary pt-2 text-sm">
            <span className="text-spa-text-secondary">Speicher</span>
            <span className="font-semibold text-spa-text-primary">{formatFileSize(totalSize)}</span>
          </div>
        </div>
      </div>
    </DashboardWidgetFrame>
  );
}
