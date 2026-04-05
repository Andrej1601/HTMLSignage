import { lazy, Suspense } from 'react';
import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { getDefaultSettings } from '@/types/settings.types';
import type { SlideConfig } from '@/types/slideshow.types';
import { OverviewSlide } from './OverviewSlide';
import {
  loadChronologicalListSlide,
  loadScheduleGridSlide,
  loadTimelineScheduleSlide,
} from './displayDynamicModules';

const LazyScheduleGridSlide = lazy(loadScheduleGridSlide);
const LazyTimelineScheduleSlide = lazy(loadTimelineScheduleSlide);
const LazyChronologicalListSlide = lazy(loadChronologicalListSlide);

interface DisplayContentPanelProps {
  schedule: Schedule;
  settings: Settings;
  slide?: SlideConfig;
  now?: Date;
  deviceId?: string;
}

function DisplayPanelFallback({ settings }: { settings: Settings }) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;

  return (
    <div
      className="w-full h-full"
      style={{ backgroundColor: theme.dashboardBg || theme.bg }}
      aria-hidden="true"
    />
  );
}

export function DisplayContentPanel({
  schedule,
  settings,
  slide,
  now,
  deviceId,
}: DisplayContentPanelProps) {
  const designStyle = settings.designStyle || 'modern-wellness';
  const fallback = <DisplayPanelFallback settings={settings} />;

  switch (designStyle) {
    case 'modern-timeline':
      return (
        <Suspense fallback={fallback}>
          <LazyTimelineScheduleSlide
            schedule={schedule}
            settings={settings}
            now={now}
            deviceId={deviceId}
          />
        </Suspense>
      );

    case 'compact-tiles':
      return (
        <Suspense fallback={fallback}>
          <LazyChronologicalListSlide
            schedule={schedule}
            settings={settings}
            now={now}
            deviceId={deviceId}
          />
        </Suspense>
      );

    case 'modern-wellness':
      return (
        <Suspense fallback={fallback}>
          <LazyScheduleGridSlide
            schedule={schedule}
            settings={settings}
            now={now}
            deviceId={deviceId}
          />
        </Suspense>
      );

    default:
      return (
        <div className="w-full h-full">
          {slide?.showTitle && slide.title ? (
            <div className="absolute top-0 left-0 right-0 bg-spa-primary text-white p-6 z-10">
              <h2 className="text-4xl font-bold">{slide.title}</h2>
            </div>
          ) : null}
          <OverviewSlide schedule={schedule} settings={settings} now={now} deviceId={deviceId} />
        </div>
      );
  }
}
