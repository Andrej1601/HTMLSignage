import { DisplayScenarioPreview } from '@/components/Display/DisplayScenarioPreview';
import { PRESET_LABELS, type Schedule } from '@/types/schedule.types';
import type { Event, Settings } from '@/types/settings.types';
import {
  getDisplayAppearanceLabel,
  getScheduleDesignStyleLabel,
} from '@/config/displayDesignStyles';
import { formatEventWindow } from '../eventManager.utils';
import type { Device } from '@/types/device.types';
import type { StepProps } from './types';

interface PreviewStepProps extends StepProps {
  previewEvent: Event;
  previewSchedule: Schedule;
  previewSettings: Settings;
  pairedDevices: Device[];
  selectedTargetDevices: Device[];
  selectedTargetDeviceIds: string[];
  previewTargetLabel: string;
  startDateTime: Date | null;
}

export function PreviewStep({
  normalizedFormData,
  previewEvent,
  previewSchedule,
  previewSettings,
  pairedDevices,
  selectedTargetDeviceIds,
  previewTargetLabel,
  startDateTime,
}: PreviewStepProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <div className="space-y-4 rounded-2xl border border-spa-bg-secondary bg-spa-bg-primary p-5 text-sm text-spa-text-secondary">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-spa-text-secondary">Zusammenfassung</div>
            <div className="mt-2 text-base font-semibold text-spa-text-primary">{normalizedFormData.name.trim() || 'Event ohne Namen'}</div>
          </div>
          <div>
            <div className="font-medium text-spa-text-primary">Aufgussplan</div>
            <div>{PRESET_LABELS[normalizedFormData.assignedPreset]}</div>
          </div>
          <div>
            <div className="font-medium text-spa-text-primary">Ziel</div>
            <div>{previewTargetLabel}</div>
          </div>
          <div>
            <div className="font-medium text-spa-text-primary">Event-Zeitraum</div>
            <div>{formatEventWindow(previewEvent)}</div>
          </div>
          <div>
            <div className="font-medium text-spa-text-primary">Design</div>
            <div>
              {previewEvent.settingsOverrides?.displayAppearance
                ? getDisplayAppearanceLabel(previewEvent.settingsOverrides.displayAppearance)
                : 'Global'}
              {' · '}
              {previewEvent.settingsOverrides?.designStyle
                ? getScheduleDesignStyleLabel(previewEvent.settingsOverrides.designStyle)
                : 'Global'}
              {previewEvent.settingsOverrides?.colorPalette ? ` · ${previewEvent.settingsOverrides.colorPalette}` : ''}
            </div>
          </div>
          <div>
            <div className="font-medium text-spa-text-primary">Slideshow</div>
            <div>{previewEvent.settingsOverrides?.slideshow ? 'Event-Slideshow aktiv' : 'Global / Geräte-Override'}</div>
          </div>
          <div>
            <div className="font-medium text-spa-text-primary">Audio</div>
            <div>{previewEvent.settingsOverrides?.audio ? 'Event-Audio aktiv' : 'Global / aus'}</div>
          </div>
        </div>

        <DisplayScenarioPreview
          schedule={previewSchedule}
          settings={previewSettings}
          devices={pairedDevices}
          allowedDeviceIds={selectedTargetDeviceIds.length > 0 ? selectedTargetDeviceIds : undefined}
          defaultDeviceId={selectedTargetDeviceIds[0] || pairedDevices[0]?.id || null}
          defaultPreviewAt={startDateTime || undefined}
          previewClassName="shadow-xs"
        />
      </div>
    </div>
  );
}
