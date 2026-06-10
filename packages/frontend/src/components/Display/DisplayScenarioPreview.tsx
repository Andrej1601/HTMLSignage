import { useMemo } from 'react';
import { DisplayLivePreview } from '@/components/Display/DisplayLivePreview';
import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { migrateSettings } from '@/utils/slideshowMigration';
import clsx from 'clsx';

interface DisplayScenarioPreviewProps {
  schedule: Schedule;
  settings: Settings;
  aspectRatio?: string;
  className?: string;
  previewClassName?: string;
}

export function DisplayScenarioPreview({
  schedule,
  settings,
  aspectRatio = '16 / 9',
  className,
  previewClassName,
}: DisplayScenarioPreviewProps) {
  const effectiveSettings = useMemo(() => migrateSettings(settings), [settings]);

  return (
    <div className={clsx(className)}>
      <DisplayLivePreview
        schedule={schedule}
        settings={effectiveSettings}
        deviceId={null}
        deviceName={null}
        // Pass `null` so the preview iframe runs on its own real-time
        // clock instead of being frozen at a moment we picked at
        // mount. Previously we passed `new Date().toISOString()` —
        // recomputed on every parent render — which tripped the
        // payload `useMemo` on every render, spammed the iframe with
        // postMessages, and caused slide rotation timers to keep
        // resetting (hence the "slides don't advance" report).
        previewAt={null}
        maintenanceMode={false}
        aspectRatio={aspectRatio}
        className={previewClassName}
      />
    </div>
  );
}
