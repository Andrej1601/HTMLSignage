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
        previewAt={new Date().toISOString()}
        maintenanceMode={false}
        aspectRatio={aspectRatio}
        className={previewClassName}
      />
    </div>
  );
}
