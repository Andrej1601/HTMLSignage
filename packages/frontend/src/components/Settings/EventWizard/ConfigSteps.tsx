import clsx from 'clsx';
import { Button } from '@/components/Button';
import { PRESET_LABELS } from '@/types/schedule.types';
import type { Event } from '@/types/settings.types';
import { useSlideshows } from '@/hooks/useSlideshows';
import { toggleTargetDeviceId } from '../eventManager.utils';
import type { Device } from '@/types/device.types';
import type { StepProps } from './types';
import type { SlideshowDefinition } from '@/types/slideshow.types';
import { Presentation } from 'lucide-react';

interface DeliveryStepProps extends StepProps {
  pairedDevices: Device[];
}

export function DeliveryStep({ formData, normalizedFormData, setFormData, pairedDevices }: DeliveryStepProps) {
  const handleToggleTargetDevice = (deviceId: string) => {
    setFormData((prev) => ({
      ...prev,
      targetDeviceIds: toggleTargetDeviceId(prev.targetDeviceIds, deviceId),
    }));
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <div>
          <label className="mb-2 block text-sm font-medium text-spa-text-primary">
            Zugewiesener Aufgussplan *
          </label>
          <select
            value={formData.assignedPreset}
            onChange={(event) => setFormData({
              ...formData,
              assignedPreset: event.target.value as Event['assignedPreset'],
            })}
            className="w-full rounded-lg border border-spa-bg-secondary bg-spa-surface text-spa-text-primary px-4 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-spa-primary"
          >
            <option value="Evt1">{PRESET_LABELS.Evt1}</option>
            <option value="Evt2">{PRESET_LABELS.Evt2}</option>
          </select>
          <p className="mt-2 text-xs text-spa-text-secondary">
            Dieser Event-Plan wird automatisch aktiv, sobald das Eventfenster erreicht ist.
          </p>
        </div>

        <div className="rounded-2xl border border-spa-bg-secondary bg-spa-bg-primary p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-spa-text-primary">Zielgeräte</div>
              <p className="text-xs text-spa-text-secondary">
                Leer = alle Displays. Markierte Geräte erhalten den Event exklusiv.
              </p>
            </div>
            <Button
              type="button"
              variant={normalizedFormData.targetDeviceIds?.length ? 'ghost' : 'secondary'}
              size="sm"
              onClick={() => setFormData((prev) => ({ ...prev, targetDeviceIds: undefined }))}
            >
              Alle Geräte
            </Button>
          </div>

          {pairedDevices.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-spa-bg-secondary bg-spa-surface px-4 py-5 text-sm text-spa-text-secondary">
              Keine gepairten Geräte vorhanden. Das Event gilt global.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {pairedDevices.map((device) => {
                const isSelected = normalizedFormData.targetDeviceIds?.includes(device.id) || false;
                return (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => handleToggleTargetDevice(device.id)}
                    className={clsx(
                      'rounded-xl border px-4 py-3 text-left transition-colors',
                      isSelected
                        ? 'border-spa-primary bg-spa-primary/10'
                        : 'border-spa-bg-secondary bg-spa-surface hover:bg-spa-bg-primary',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-spa-text-primary">{device.name}</div>
                        <div className="text-xs text-spa-text-secondary">
                          {device.lastSeen ? `Zuletzt: ${new Date(device.lastSeen).toLocaleString('de-DE')}` : 'Noch kein Heartbeat'}
                        </div>
                      </div>
                      <span className={clsx(
                        'rounded-full px-2.5 py-1 text-xs font-semibold',
                        isSelected
                          ? 'bg-spa-primary text-white'
                          : 'bg-spa-bg-secondary text-spa-text-secondary',
                      )}>
                        {isSelected ? 'Ausgewählt' : 'Optional'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SlideshowStep({ formData, setFormData }: StepProps) {
  const { data: slideshows = [] } = useSlideshows();
  const selectedSlideshow = slideshows.find((s: SlideshowDefinition) => s.id === formData.slideshowId);
  const defaultSlideshow = slideshows.find((s: SlideshowDefinition) => s.isDefault);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-spa-bg-secondary bg-spa-bg-primary p-5">
        <div className="text-sm font-semibold text-spa-text-primary mb-1">Event-Slideshow auswählen</div>
        <p className="text-xs text-spa-text-secondary mb-4">
          Diese Slideshow wird automatisch während des Events anstelle der normalen Slideshow ausgespielt.
          Nach dem Event wird zur vorherigen Slideshow zurückgewechselt.
        </p>

        <select
          value={formData.slideshowId || ''}
          onChange={(e) => setFormData((prev) => ({
            ...prev,
            slideshowId: e.target.value || undefined,
            // Clear legacy overrides when switching to new model
            settingsOverrides: undefined,
          }))}
          className="w-full rounded-lg border border-spa-bg-secondary bg-spa-surface text-spa-text-primary px-4 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-spa-primary"
        >
          <option value="">Keine eigene Slideshow (Aufgussplan-Wechsel only)</option>
          {slideshows.map((show: SlideshowDefinition) => (
            <option key={show.id} value={show.id}>
              {show.name} {show.isDefault ? '(Standard)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Transparenz-Anzeige */}
      <div className="rounded-2xl border border-spa-border bg-spa-surface p-5 space-y-3">
        <div className="text-sm font-semibold text-spa-text-primary">Ablauf</div>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-spa-primary" />
            <div className="w-0.5 h-8 bg-spa-bg-secondary" />
            <div className="w-3 h-3 rounded-full bg-spa-success" />
          </div>
          <div className="space-y-4 flex-1">
            <div>
              <p className="text-sm font-medium text-spa-primary">Während des Events</p>
              <div className="flex items-center gap-2 mt-1 text-sm text-spa-text-secondary">
                <Presentation className="w-4 h-4 shrink-0" />
                {selectedSlideshow ? (
                  <span>Slideshow: <span className="font-semibold text-spa-text-primary">{selectedSlideshow.name}</span></span>
                ) : (
                  <span>Keine eigene Slideshow — nur Aufgussplan-Wechsel</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-spa-success">Nach dem Event</p>
              <div className="flex items-center gap-2 mt-1 text-sm text-spa-text-secondary">
                <Presentation className="w-4 h-4 shrink-0" />
                <span>Zurück zu: <span className="font-semibold text-spa-text-primary">{defaultSlideshow?.name || 'Standard-Slideshow'}</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedSlideshow && (
        <div className="p-3 rounded-lg bg-spa-info-light border border-spa-info/20 text-spa-info-dark text-xs leading-relaxed">
          Audio, Design und Slide-Konfiguration der Event-Slideshow können im Slideshow-Editor unter „Slideshows" bearbeitet werden.
        </div>
      )}
    </div>
  );
}
