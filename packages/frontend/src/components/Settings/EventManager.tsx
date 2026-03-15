import { useMemo, useState } from 'react';
import { DisplayScenarioPreview } from '@/components/Display/DisplayScenarioPreview';
import { AudioConfigEditor } from '@/components/Settings/AudioConfigEditor';
import { Button } from '@/components/Button';
import { SectionCard } from '@/components/SectionCard';
import { SlideshowConfigPanel } from '@/components/Slideshow/SlideshowConfigPanel';
import { useDevices } from '@/hooks/useDevices';
import { useMedia } from '@/hooks/useMedia';
import { createDefaultSchedule, PRESET_LABELS, type Schedule } from '@/types/schedule.types';
import { createDefaultSlideshowConfig } from '@/types/slideshow.types';
import {
  COLOR_PALETTES,
  isEventActive,
  type AudioSettings,
  type ColorPaletteName,
  type DesignStyle,
  type DisplayAppearance,
  type Event,
  type EventSettingsOverrides,
  type Settings,
} from '@/types/settings.types';
import { getMediaUploadUrl } from '@/utils/mediaUrl';
import { EditorQualityAssistant } from '@/components/EditorQualityAssistant';
import {
  DISPLAY_APPEARANCE_OPTIONS,
  SCHEDULE_DESIGN_STYLE_OPTIONS,
  getDisplayAppearanceLabel,
  getScheduleDesignStyleLabel,
} from '@/config/displayDesignStyles';
import { getEventQualityIssues } from '@/utils/editorQuality';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock3,
  Edit2,
  ImagePlus,
  Layers,
  MonitorSmartphone,
  Music2,
  Palette,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';
import clsx from 'clsx';

interface EventManagerProps {
  events: Event[];
  settings: Settings;
  schedule?: Schedule | null;
  onChange: (events: Event[]) => void;
}

type EventDraft = Omit<Event, 'id'>;
type AssistantMode = 'idle' | 'create' | 'edit';

const DEFAULT_EVENT_AUDIO: AudioSettings = {
  enabled: false,
  volume: 0.5,
  loop: true,
};

const ASSISTANT_STEPS = [
  { id: 'basics', label: 'Basis', icon: Wand2 },
  { id: 'timing', label: 'Zeitraum', icon: Calendar },
  { id: 'delivery', label: 'Ausspielung', icon: MonitorSmartphone },
  { id: 'slideshow', label: 'Slideshow', icon: Layers },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'audio', label: 'Audio', icon: Music2 },
  { id: 'preview', label: 'Vorschau', icon: Sparkles },
] as const;

function formatDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function createBlankEvent(): EventDraft {
  const today = formatDateInput(new Date());
  return {
    name: '',
    description: '',
    imageId: undefined,
    startDate: today,
    startTime: '10:00',
    endDate: undefined,
    endTime: '23:59',
    assignedPreset: 'Evt1',
    isActive: true,
    targetDeviceIds: undefined,
    settingsOverrides: undefined,
  };
}

function normalizeOverrides(raw?: EventSettingsOverrides): EventSettingsOverrides | undefined {
  if (!raw) return undefined;

  const next: EventSettingsOverrides = {};

  if (raw.displayAppearance) next.displayAppearance = raw.displayAppearance;
  if (raw.designStyle) next.designStyle = raw.designStyle;
  if (raw.colorPalette) next.colorPalette = raw.colorPalette;
  if (raw.theme && Object.keys(raw.theme).length > 0) next.theme = raw.theme;
  if (raw.fonts && Object.keys(raw.fonts).length > 0) next.fonts = raw.fonts;
  if (raw.slides && Object.keys(raw.slides).length > 0) next.slides = raw.slides;
  if (raw.display && Object.keys(raw.display).length > 0) next.display = raw.display;
  if (raw.header && Object.keys(raw.header).length > 0) next.header = raw.header;
  if (raw.slideshow) next.slideshow = raw.slideshow;
  if (raw.audio) next.audio = raw.audio;

  return Object.keys(next).length > 0 ? next : undefined;
}

function sanitizeTargetDeviceIds(raw?: string[]): string[] | undefined {
  const values = Array.isArray(raw)
    ? Array.from(new Set(raw.map((value) => String(value).trim()).filter(Boolean)))
    : [];
  return values.length > 0 ? values : undefined;
}

function getEventBounds(event: Pick<EventDraft, 'startDate' | 'startTime' | 'endDate' | 'endTime'>): {
  start: Date | null;
  end: Date | null;
} {
  const start = event.startDate && event.startTime
    ? new Date(`${event.startDate}T${event.startTime}`)
    : null;
  const endDate = event.endDate || event.startDate;
  const endTime = event.endTime || '23:59';
  const end = endDate && endTime ? new Date(`${endDate}T${endTime}`) : null;

  return {
    start: start && !Number.isNaN(start.getTime()) ? start : null,
    end: end && !Number.isNaN(end.getTime()) ? end : null,
  };
}

function buildPreviewEvent(draft: EventDraft, editingId: string | null): Event {
  return {
    id: editingId || 'event-preview',
    ...draft,
    name: draft.name.trim() || 'Event-Vorschau',
    description: draft.description?.trim() || undefined,
    endDate: draft.endDate || draft.startDate,
    endTime: draft.endTime || '23:59',
    isActive: true,
    targetDeviceIds: sanitizeTargetDeviceIds(draft.targetDeviceIds),
    settingsOverrides: normalizeOverrides(draft.settingsOverrides),
  };
}

function formatEventWindow(event: Pick<Event, 'startDate' | 'startTime' | 'endDate' | 'endTime'>): string {
  const start = new Date(`${event.startDate}T${event.startTime}`);
  const endDate = event.endDate || event.startDate;
  const endTime = event.endTime || '23:59';
  const end = new Date(`${endDate}T${endTime}`);

  const startLabel = start.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const endLabel = end.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${startLabel} bis ${endLabel}`;
}

export function EventManager({ events, settings, schedule, onChange }: EventManagerProps) {
  const { data: media } = useMedia();
  const { data: devices } = useDevices();
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('idle');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [formData, setFormData] = useState<EventDraft>(() => createBlankEvent());

  const pairedDevices = useMemo(
    () => (devices || []).filter((device) => Boolean(device.pairedAt)),
    [devices],
  );

  const imageList = useMemo(
    () => (media || []).filter((item) => item.type === 'image'),
    [media],
  );

  const normalizedFormData = useMemo<EventDraft>(() => ({
    ...formData,
    targetDeviceIds: sanitizeTargetDeviceIds(formData.targetDeviceIds),
    settingsOverrides: normalizeOverrides(formData.settingsOverrides),
  }), [formData]);

  const selectedTargetDevices = useMemo(
    () => pairedDevices.filter((device) => normalizedFormData.targetDeviceIds?.includes(device.id)),
    [normalizedFormData.targetDeviceIds, pairedDevices],
  );
  const selectedTargetDeviceIds = useMemo(
    () => normalizedFormData.targetDeviceIds ?? [],
    [normalizedFormData.targetDeviceIds],
  );

  const { start: startDateTime, end: endDateTime } = useMemo(
    () => getEventBounds(normalizedFormData),
    [normalizedFormData],
  );

  const isTimeRangeValid = Boolean(
    startDateTime &&
    endDateTime &&
    startDateTime.getTime() <= endDateTime.getTime(),
  );

  const previewEvent = useMemo(
    () => buildPreviewEvent(normalizedFormData, editingId),
    [editingId, normalizedFormData],
  );

  const previewSettings = useMemo<Settings>(() => ({
    ...settings,
    events: [previewEvent],
  }), [previewEvent, settings]);

  const previewSchedule = schedule || createDefaultSchedule();
  const previewTargetLabel = selectedTargetDevices.length > 0
    ? selectedTargetDevices.length === 1
      ? selectedTargetDevices[0].name
      : `${selectedTargetDevices.length} Geräte`
    : selectedTargetDeviceIds.length > 0
      ? `${selectedTargetDeviceIds.length} Geräte`
      : 'Alle Geräte';
  const effectivePrestartMinutes = normalizedFormData.settingsOverrides?.display?.prestartMinutes
    ?? settings.display?.prestartMinutes
    ?? 10;
  const eventQualityIssues = useMemo(() => getEventQualityIssues({
    events,
    devices: pairedDevices,
    media: media || [],
    schedule,
    draft: assistantMode === 'idle'
      ? null
      : {
          id: editingId || undefined,
          ...normalizedFormData,
        },
  }), [assistantMode, editingId, events, media, normalizedFormData, pairedDevices, schedule]);

  const canSave = Boolean(
    normalizedFormData.name.trim() &&
    normalizedFormData.startDate &&
    normalizedFormData.startTime &&
    isTimeRangeValid,
  );

  const stepValidationMessage = useMemo(() => {
    const currentStepId = ASSISTANT_STEPS[stepIndex]?.id;

    if (currentStepId === 'basics' && !normalizedFormData.name.trim()) {
      return 'Bitte vergeben Sie zuerst einen Event-Namen.';
    }

    if (currentStepId === 'timing') {
      if (!normalizedFormData.startDate || !normalizedFormData.startTime) {
        return 'Bitte definieren Sie Startdatum und Startzeit.';
      }
      if (!isTimeRangeValid) {
        return 'Das Event-Ende muss nach dem Start liegen.';
      }
    }

    if (currentStepId === 'preview' && !canSave) {
      return 'Für die Vorschau fehlt noch ein vollständiger und gültiger Event-Zeitraum.';
    }

    return null;
  }, [canSave, isTimeRangeValid, normalizedFormData.name, normalizedFormData.startDate, normalizedFormData.startTime, stepIndex]);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => {
      const aStart = new Date(`${a.startDate}T${a.startTime}`).getTime();
      const bStart = new Date(`${b.startDate}T${b.startTime}`).getTime();
      return bStart - aStart;
    }),
    [events],
  );

  const getImageUrl = (imageId?: string) => getMediaUploadUrl(media, imageId);

  const resetAssistant = () => {
    setAssistantMode('idle');
    setEditingId(null);
    setStepIndex(0);
    setFormData(createBlankEvent());
  };

  const handleStartAdd = () => {
    setFormData(createBlankEvent());
    setAssistantMode('create');
    setEditingId(null);
    setStepIndex(0);
  };

  const handleStartEdit = (event: Event) => {
    setFormData({
      name: event.name,
      description: event.description || '',
      imageId: event.imageId,
      startDate: event.startDate,
      startTime: event.startTime,
      endDate: event.endDate,
      endTime: event.endTime || '23:59',
      assignedPreset: event.assignedPreset,
      isActive: event.isActive,
      targetDeviceIds: sanitizeTargetDeviceIds(event.targetDeviceIds),
      settingsOverrides: normalizeOverrides(event.settingsOverrides),
    });
    setAssistantMode('edit');
    setEditingId(event.id);
    setStepIndex(0);
  };

  const handleSave = () => {
    if (!canSave) return;

    const nextEvent: Event = {
      id: editingId || `${Date.now()}`,
      ...normalizedFormData,
      name: normalizedFormData.name.trim(),
      description: normalizedFormData.description?.trim() || undefined,
      targetDeviceIds: sanitizeTargetDeviceIds(normalizedFormData.targetDeviceIds),
      settingsOverrides: normalizeOverrides(normalizedFormData.settingsOverrides),
    };

    if (assistantMode === 'create') {
      onChange([...events, nextEvent]);
    } else if (editingId) {
      onChange(events.map((event) => (event.id === editingId ? nextEvent : event)));
    }

    resetAssistant();
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Möchten Sie dieses Event wirklich löschen?')) return;
    onChange(events.filter((event) => event.id !== id));
    if (editingId === id) resetAssistant();
  };

  const handleToggleActive = (id: string) => {
    onChange(events.map((event) => (event.id === id ? { ...event, isActive: !event.isActive } : event)));
  };

  const updateOverrides = (patch: Partial<EventSettingsOverrides>) => {
    setFormData((prev) => {
      const merged: EventSettingsOverrides = {
        ...(prev.settingsOverrides || {}),
        ...patch,
      };

      if ('audio' in patch && !patch.audio) delete merged.audio;
      if ('displayAppearance' in patch && !patch.displayAppearance) delete merged.displayAppearance;
      if ('designStyle' in patch && !patch.designStyle) delete merged.designStyle;
      if ('colorPalette' in patch && !patch.colorPalette) delete merged.colorPalette;

      return {
        ...prev,
        settingsOverrides: normalizeOverrides(merged),
      };
    });
  };

  const handleToggleTargetDevice = (deviceId: string) => {
    setFormData((prev) => {
      const current = new Set(prev.targetDeviceIds || []);
      if (current.has(deviceId)) current.delete(deviceId);
      else current.add(deviceId);

      return {
        ...prev,
        targetDeviceIds: current.size > 0 ? Array.from(current) : undefined,
      };
    });
  };

  const currentStep = ASSISTANT_STEPS[stepIndex];
  const currentStepId = currentStep.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-spa-text-primary">Event-Assistent</h3>
          <p className="text-sm text-spa-text-secondary">
            Zeitraum, Zielgeräte, Plan, Design und Audio in einem durchgehenden Ablauf vorbereiten.
          </p>
        </div>
        {assistantMode === 'idle' && (
          <Button icon={Plus} onClick={handleStartAdd}>
            Neues Event
          </Button>
        )}
      </div>

      <EditorQualityAssistant
        description={assistantMode === 'idle'
          ? 'Prüft die bestehende Event-Bibliothek auf leere Event-Pläne, Konflikte und veraltete Referenzen.'
          : 'Prüft den aktuellen Event-Entwurf direkt im Bearbeitungskontext auf Konflikte und fehlende Bausteine.'}
        issues={eventQualityIssues}
        okMessage={assistantMode === 'idle'
          ? 'Für die vorhandenen Events wurden aktuell keine auffälligen Konfigurationsprobleme erkannt.'
          : 'Der aktuelle Event-Entwurf ist aus Sicht der Redaktionslogik aktuell konsistent vorbereitet.'}
      />

      {assistantMode !== 'idle' && (
        <SectionCard
          title={assistantMode === 'create' ? 'Neues Event vorbereiten' : 'Event bearbeiten'}
          description="Der Assistent führt nacheinander durch Inhalt, Zeitraum, Zielgeräte, Design, Audio und Vorschau."
          icon={Sparkles}
          actions={(
            <span className="rounded-full bg-spa-accent/10 px-3 py-1 text-xs font-semibold text-spa-accent">
              Schritt {stepIndex + 1} von {ASSISTANT_STEPS.length}: {currentStep.label}
            </span>
          )}
        >
          <div className="space-y-6">
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              {ASSISTANT_STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = index === stepIndex;
                const isCompleted = index < stepIndex;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setStepIndex(index)}
                    className={clsx(
                      'rounded-xl border px-4 py-3 text-left transition-colors',
                      isActive && 'border-spa-primary bg-spa-primary/10',
                      !isActive && isCompleted && 'border-spa-success/30 bg-spa-success-light/60',
                      !isActive && !isCompleted && 'border-spa-bg-secondary bg-spa-bg-primary hover:bg-spa-bg-secondary/60',
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-spa-text-primary">
                      <StepIcon className="h-4 w-4" />
                      {step.label}
                    </div>
                    <div className="mt-1 text-xs text-spa-text-secondary">
                      {isCompleted ? 'Bereit' : isActive ? 'Aktuell' : `Schritt ${index + 1}`}
                    </div>
                  </button>
                );
              })}
            </div>

            {stepValidationMessage && (
              <div className="rounded-xl border border-spa-warning/30 bg-spa-warning-light px-4 py-3 text-sm text-spa-warning-dark">
                {stepValidationMessage}
              </div>
            )}

            {currentStepId === 'basics' && (
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
            )}

            {currentStepId === 'timing' && (
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
            )}

            {currentStepId === 'delivery' && (
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
            )}

            {currentStepId === 'slideshow' && (
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
            )}

            {currentStepId === 'design' && (
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
            )}

            {currentStepId === 'audio' && (
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
            )}

            {currentStepId === 'preview' && (
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
                    defaultDeviceId={selectedTargetDevices[0]?.id || pairedDevices[0]?.id || null}
                    defaultPreviewAt={startDateTime || undefined}
                    previewClassName="shadow-sm"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-spa-bg-secondary pt-4 md:flex-row md:items-center md:justify-between">
              <Button type="button" variant="ghost" icon={X} onClick={resetAssistant}>
                Abbrechen
              </Button>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  icon={ArrowLeft}
                  disabled={stepIndex === 0}
                  onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                >
                  Zurück
                </Button>

                {stepIndex < ASSISTANT_STEPS.length - 1 ? (
                  <Button
                    type="button"
                    iconRight={ArrowRight}
                    disabled={Boolean(stepValidationMessage)}
                    onClick={() => setStepIndex((current) => Math.min(ASSISTANT_STEPS.length - 1, current + 1))}
                  >
                    Weiter
                  </Button>
                ) : (
                  <Button
                    type="button"
                    icon={Save}
                    disabled={!canSave}
                    onClick={handleSave}
                  >
                    {assistantMode === 'create' ? 'Event anlegen' : 'Änderungen speichern'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Geplante Events"
        description={`${events.length} Event${events.length === 1 ? '' : 's'} vorbereitet`}
        icon={Calendar}
      >
        {sortedEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-spa-bg-secondary bg-spa-bg-primary px-4 py-12 text-center text-spa-text-secondary">
            <Calendar className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p className="font-medium">Noch keine Events vorhanden</p>
            <p className="mt-1 text-sm">Mit dem Assistenten können Sie komplette Event-Slots inklusive Zielgeräten und Musik vorbereiten.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedEvents.map((event) => {
              const imageUrl = getImageUrl(event.imageId);
              const isCurrentlyActive = isEventActive(event);
              const targetDeviceNames = pairedDevices
                .filter((device) => event.targetDeviceIds?.includes(device.id))
                .map((device) => device.name);
              const targetLabel = targetDeviceNames.length > 0
                ? targetDeviceNames.join(', ')
                : event.targetDeviceIds?.length
                  ? `${event.targetDeviceIds.length} Gerät${event.targetDeviceIds.length === 1 ? '' : 'e'}`
                  : 'Alle Geräte';

              return (
                <div
                  key={event.id}
                  className={clsx(
                    'rounded-2xl border p-4 transition-colors',
                    isCurrentlyActive
                      ? 'border-spa-success bg-spa-success-light/40'
                      : event.isActive
                        ? 'border-spa-bg-secondary bg-white hover:bg-spa-bg-primary/50'
                        : 'border-spa-bg-secondary bg-spa-bg-primary/60 opacity-75',
                  )}
                >
                  <div className="flex flex-col gap-4 xl:flex-row">
                    {imageUrl && (
                      <img
                        src={imageUrl}
                        alt={event.name}
                        className="h-40 w-full rounded-2xl object-cover xl:w-64"
                        loading="lazy"
                      />
                    )}

                    <div className="flex-1 space-y-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-lg font-semibold text-spa-text-primary">{event.name}</h4>
                            {isCurrentlyActive && (
                              <span className="rounded-full bg-spa-success px-3 py-1 text-xs font-semibold text-white">
                                Läuft jetzt
                              </span>
                            )}
                            {!event.isActive && (
                              <span className="rounded-full bg-spa-bg-secondary px-3 py-1 text-xs font-semibold text-spa-text-secondary">
                                Inaktiv
                              </span>
                            )}
                          </div>
                          {event.description && (
                            <p className="mt-1 text-sm text-spa-text-secondary">{event.description}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(event.id)}
                          >
                            {event.isActive ? 'Deaktivieren' : 'Aktivieren'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            icon={Edit2}
                            onClick={() => handleStartEdit(event)}
                          >
                            Bearbeiten
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            icon={Trash2}
                            onClick={() => handleDelete(event.id)}
                          >
                            Löschen
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl bg-spa-bg-primary px-3 py-2 text-sm text-spa-text-secondary">
                          <div className="font-medium text-spa-text-primary">Zeitfenster</div>
                          <div className="mt-1">{formatEventWindow(event)}</div>
                        </div>
                        <div className="rounded-xl bg-spa-bg-primary px-3 py-2 text-sm text-spa-text-secondary">
                          <div className="font-medium text-spa-text-primary">Plan</div>
                          <div className="mt-1">{PRESET_LABELS[event.assignedPreset]}</div>
                        </div>
                        <div className="rounded-xl bg-spa-bg-primary px-3 py-2 text-sm text-spa-text-secondary">
                          <div className="font-medium text-spa-text-primary">Zielgeräte</div>
                          <div className="mt-1">{targetLabel}</div>
                        </div>
                        <div className="rounded-xl bg-spa-bg-primary px-3 py-2 text-sm text-spa-text-secondary">
                          <div className="font-medium text-spa-text-primary">Overrides</div>
                          <div className="mt-1">
                            {event.settingsOverrides?.designStyle || event.settingsOverrides?.colorPalette || event.settingsOverrides?.audio || event.settingsOverrides?.slideshow
                              ? [
                                  event.settingsOverrides?.designStyle ? 'Design' : null,
                                  event.settingsOverrides?.colorPalette ? 'Palette' : null,
                                  event.settingsOverrides?.slideshow ? 'Slideshow' : null,
                                  event.settingsOverrides?.audio ? 'Audio' : null,
                                ].filter(Boolean).join(' · ')
                              : 'Keine'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
