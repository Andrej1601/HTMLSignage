import { useMemo } from 'react';
import { DisplayScenarioPreview } from '@/components/Display/DisplayScenarioPreview';
import { AudioConfigEditor } from '@/components/Settings/AudioConfigEditor';
import { Button } from '@/components/Button';
import { SlideshowConfigPanel } from '@/components/Slideshow/SlideshowConfigPanel';
import { PRESET_LABELS, type Schedule } from '@/types/schedule.types';
import { createDefaultSlideshowConfig } from '@/types/slideshow.types';
import {
  COLOR_PALETTES,
  type AudioSettings,
  type ColorPaletteName,
  type DesignStyle,
  type DisplayAppearance,
  type Event,
  type EventSettingsOverrides,
  type Settings,
} from '@/types/settings.types';
import { getMediaUploadUrl } from '@/utils/mediaUrl';
import { useMedia } from '@/hooks/useMedia';
import {
  DISPLAY_APPEARANCE_OPTIONS,
  SCHEDULE_DESIGN_STYLE_OPTIONS,
  getDisplayAppearanceLabel,
  getScheduleDesignStyleLabel,
} from '@/config/displayDesignStyles';
import {
  Calendar,
  CheckCircle2,
  Clock3,
  ImagePlus,
  XCircle,
} from 'lucide-react';
import clsx from 'clsx';
import {
  formatEventWindow,
  toggleTargetDeviceId,
  type EventDraft,
} from './eventManager.utils';
import type { Device } from '@/types/device.types';

interface StepProps {
  formData: EventDraft;
  normalizedFormData: EventDraft;
  setFormData: React.Dispatch<React.SetStateAction<EventDraft>>;
  updateOverrides: (patch: Partial<EventSettingsOverrides>) => void;
}

const DEFAULT_EVENT_AUDIO: AudioSettings = {
  enabled: false,
  volume: 0.5,
  loop: true,
};

export function BasicsStep({ formData, setFormData }: StepProps) {
  const { data: media } = useMedia();
  const imageList = useMemo(
    () => (media || []).filter((item) => item.type === 'image'),
    [media],
  );
  const getImageUrl = (imageId?: string) => getMediaUploadUrl(media, imageId);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-spa-text-primary">Event-Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(event) => setFormData({ ...formData, name: event.target.value })}
            className="w-full rounded-lg border border-spa-bg-secondary px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-spa-primary"
            placeholder="z. B. Saunanacht, Frauentag, Sommer-Event"
            autoFocus
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-spa-text-primary">Beschreibung</label>
          <textarea
            value={formData.description || ''}
            onChange={(event) => setFormData({ ...formData, description: event.target.value })}
            className="min-h-[140px] w-full rounded-lg border border-spa-bg-secondary px-4 py-3 focus:outline-none focus:ring-2 focus:ring-spa-primary"
            placeholder="Interner Hinweis oder kurzer Kundentext für dieses Event"
          />
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-spa-text-primary">Status</span>
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
            className={clsx(
              'flex w-full items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors',
              formData.isActive
                ? 'border-spa-success bg-spa-success-light text-spa-success-dark'
                : 'border-spa-bg-secondary bg-spa-bg-primary text-spa-text-secondary',
            )}
          >
            {formData.isActive ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {formData.isActive ? 'Event ist aktivierbar' : 'Event bleibt deaktiviert'}
          </button>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-spa-bg-secondary bg-spa-bg-primary p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-spa-text-primary">
          <ImagePlus className="h-4 w-4" />
          Event-Bild
        </div>
        {imageList.length > 0 ? (
          <>
            <select
              value={formData.imageId || ''}
              onChange={(event) => setFormData({ ...formData, imageId: event.target.value || undefined })}
              className="w-full rounded-lg border border-spa-bg-secondary px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-spa-primary"
            >
              <option value="">Kein Bild</option>
              {imageList.map((image) => (
                <option key={image.id} value={image.id}>
                  {image.originalName}
                </option>
              ))}
            </select>

            <div className="overflow-hidden rounded-2xl border border-spa-bg-secondary bg-white">
              {formData.imageId ? (
                <img
                  src={getImageUrl(formData.imageId) || ''}
                  alt="Event-Vorschau"
                  className="h-64 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-spa-text-secondary">
                  Kein Bild ausgewählt
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-spa-bg-secondary bg-white px-4 py-6 text-sm text-spa-text-secondary">
            Keine Bilder verfügbar. Laden Sie zuerst Medien hoch, wenn das Event eine Bildfläche bekommen soll.
          </div>
        )}
      </div>
    </div>
  );
}

export function TimingStep({ formData, normalizedFormData, setFormData }: StepProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-spa-text-primary">Startdatum *</label>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-spa-text-secondary" />
          <input
            type="date"
            value={formData.startDate}
            onChange={(event) => setFormData({ ...formData, startDate: event.target.value })}
            className="w-full rounded-lg border border-spa-bg-secondary py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-spa-primary"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-spa-text-primary">Startzeit *</label>
        <div className="relative">
          <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-spa-text-secondary" />
          <input
            type="time"
            value={formData.startTime}
            onChange={(event) => setFormData({ ...formData, startTime: event.target.value })}
            className="w-full rounded-lg border border-spa-bg-secondary py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-spa-primary"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-spa-text-primary">Enddatum</label>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-spa-text-secondary" />
          <input
            type="date"
            value={formData.endDate || ''}
            onChange={(event) => setFormData({ ...formData, endDate: event.target.value || undefined })}
            className="w-full rounded-lg border border-spa-bg-secondary py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-spa-primary"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-spa-text-primary">Endzeit</label>
        <div className="relative">
          <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-spa-text-secondary" />
          <input
            type="time"
            value={formData.endTime || ''}
            onChange={(event) => setFormData({ ...formData, endTime: event.target.value || undefined })}
            className="w-full rounded-lg border border-spa-bg-secondary py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-spa-primary"
          />
        </div>
      </div>

      <div className="md:col-span-2 xl:col-span-4 rounded-2xl border border-spa-bg-secondary bg-spa-bg-primary p-4 text-sm text-spa-text-secondary">
        <div className="font-medium text-spa-text-primary">Geplantes Zeitfenster</div>
        <div className="mt-1">
          {normalizedFormData.startDate && normalizedFormData.startTime
            ? formatEventWindow({
                startDate: normalizedFormData.startDate,
                startTime: normalizedFormData.startTime,
                endDate: normalizedFormData.endDate,
                endTime: normalizedFormData.endTime,
              } as Event)
            : 'Noch nicht vollständig definiert'}
        </div>
      </div>
    </div>
  );
}

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
            className="w-full rounded-lg border border-spa-bg-secondary px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-spa-primary"
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
                Leer bedeutet: Event gilt für alle Displays. Markierte Geräte erhalten den Event-Plan exklusiv.
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
            <div className="mt-4 rounded-xl border border-dashed border-spa-bg-secondary bg-white px-4 py-5 text-sm text-spa-text-secondary">
              Aktuell sind keine gepairten Geräte vorhanden. Das Event bleibt dadurch global vorbereitet.
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
                        : 'border-spa-bg-secondary bg-white hover:bg-spa-bg-primary',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-spa-text-primary">{device.name}</div>
                        <div className="text-xs text-spa-text-secondary">
                          {device.lastSeen ? `Letzter Kontakt: ${new Date(device.lastSeen).toLocaleString('de-DE')}` : 'Noch kein Heartbeat'}
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

interface SlideshowStepProps extends StepProps {
  settings: Settings;
  previewSchedule: Schedule;
  previewSettings: Settings;
  effectivePrestartMinutes: number;
}

export function SlideshowStep({
  formData,
  updateOverrides,
  previewSchedule,
  previewSettings,
  effectivePrestartMinutes,
}: SlideshowStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-spa-bg-secondary bg-spa-bg-primary p-4">
        <div>
          <div className="text-sm font-semibold text-spa-text-primary">Eigene Event-Slideshow</div>
          <p className="text-xs text-spa-text-secondary">
            Optional kann dieses Event eine eigene Slideshow mit Layout, Slides und Übergängen erhalten. Sie wird nur im Event-Zeitraum ausgespielt.
          </p>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={Boolean(formData.settingsOverrides?.slideshow)}
            onChange={(event) => {
              if (event.target.checked) {
                updateOverrides({ slideshow: formData.settingsOverrides?.slideshow || createDefaultSlideshowConfig() });
              } else {
                updateOverrides({ slideshow: undefined });
              }
            }}
            className="peer sr-only"
            aria-label="Eigene Event-Slideshow"
          />
          <div className="h-6 w-11 rounded-full bg-spa-bg-secondary peer-checked:bg-spa-accent peer-checked:after:translate-x-full after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-['']"></div>
        </label>
      </div>

      {formData.settingsOverrides?.slideshow ? (
        <SlideshowConfigPanel
          config={formData.settingsOverrides.slideshow}
          previewSchedule={previewSchedule}
          previewSettings={previewSettings}
          isDirty
          prestartMinutes={effectivePrestartMinutes}
          onChange={(nextConfig) => updateOverrides({ slideshow: nextConfig })}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-spa-bg-secondary bg-white px-4 py-6 text-sm text-spa-text-secondary">
          Ohne Event-Slideshow läuft während des Events weiter die globale bzw. gerätespezifische Slideshow, nur der Event-Plan wird umgeschaltet.
        </div>
      )}
    </div>
  );
}

export function DesignStep({ formData, updateOverrides }: StepProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div>
        <label className="mb-2 block text-sm font-medium text-spa-text-primary">Visuelle Aufmachung</label>
        <select
          value={formData.settingsOverrides?.displayAppearance || ''}
          onChange={(event) => {
            const value = event.target.value as DisplayAppearance | '';
            updateOverrides({ displayAppearance: value || undefined });
          }}
          className="w-full rounded-lg border border-spa-bg-secondary px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-spa-primary"
        >
          <option value="">Globale Aufmachung übernehmen</option>
          {DISPLAY_APPEARANCE_OPTIONS.map((appearance) => (
            <option key={appearance.id} value={appearance.id}>
              {appearance.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-spa-text-primary">Plan-Darstellung</label>
        <select
          value={formData.settingsOverrides?.designStyle || ''}
          onChange={(event) => {
            const value = event.target.value as DesignStyle | '';
            updateOverrides({ designStyle: value || undefined });
          }}
          className="w-full rounded-lg border border-spa-bg-secondary px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-spa-primary"
        >
          <option value="">Globale Plan-Darstellung übernehmen</option>
          {SCHEDULE_DESIGN_STYLE_OPTIONS.map((style) => (
            <option key={style.id} value={style.id}>
              {style.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-spa-text-primary">Farbpalette</label>
        <select
          value={formData.settingsOverrides?.colorPalette || ''}
          onChange={(event) => {
            const value = event.target.value as ColorPaletteName | '';
            updateOverrides({ colorPalette: value || undefined });
          }}
          className="w-full rounded-lg border border-spa-bg-secondary px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-spa-primary"
        >
          <option value="">Globale Farbpalette übernehmen</option>
          {COLOR_PALETTES.map((palette) => (
            <option key={palette.id} value={palette.id}>
              {palette.name}
            </option>
          ))}
        </select>
      </div>

      <div className="xl:col-span-2 rounded-2xl border border-spa-bg-secondary bg-spa-bg-primary p-4 text-sm text-spa-text-secondary">
        <div className="font-medium text-spa-text-primary">Aktuelle Event-Overrides</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-spa-text-primary">
            Aufmachung: {formData.settingsOverrides?.displayAppearance ? getDisplayAppearanceLabel(formData.settingsOverrides.displayAppearance) : 'Global'}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-spa-text-primary">
            Plan: {formData.settingsOverrides?.designStyle ? getScheduleDesignStyleLabel(formData.settingsOverrides.designStyle) : 'Global'}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-spa-text-primary">
            Palette: {formData.settingsOverrides?.colorPalette ? formData.settingsOverrides.colorPalette : 'Global'}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AudioStep({ formData, updateOverrides }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-spa-bg-secondary bg-spa-bg-primary p-4">
        <div>
          <div className="text-sm font-semibold text-spa-text-primary">Event-Musik aktivieren</div>
          <p className="text-xs text-spa-text-secondary">
            Die Musik gilt nur während dieses Events und ersetzt die globale Audiokonfiguration für diesen Zeitraum.
          </p>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={Boolean(formData.settingsOverrides?.audio)}
            onChange={(event) => {
              if (event.target.checked) updateOverrides({ audio: { ...DEFAULT_EVENT_AUDIO } });
              else updateOverrides({ audio: undefined });
            }}
            className="peer sr-only"
            aria-label="Event-Musik aktivieren"
          />
          <div className="h-6 w-11 rounded-full bg-spa-bg-secondary peer-checked:bg-spa-accent peer-checked:after:translate-x-full after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-['']"></div>
        </label>
      </div>

      {formData.settingsOverrides?.audio ? (
        <AudioConfigEditor
          audio={formData.settingsOverrides.audio}
          onChange={(nextAudio) => updateOverrides({ audio: nextAudio })}
          title="Event-Hintergrundmusik"
          subtitle="Diese Musik startet zusammen mit dem Event und endet automatisch nach dem Eventfenster."
          showEnableToggle
          enableLabel="Event-Musik aktivieren"
          enableDescription="Überschreibt die globale Musik nur für dieses Event."
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-spa-bg-secondary bg-white px-4 py-6 text-sm text-spa-text-secondary">
          Keine Event-Musik konfiguriert. Das Event nutzt dann die globale Audio-Einstellung.
        </div>
      )}
    </div>
  );
}

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
          previewClassName="shadow-sm"
        />
      </div>
    </div>
  );
}
