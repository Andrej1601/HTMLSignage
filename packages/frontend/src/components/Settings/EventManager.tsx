import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { SectionCard } from '@/components/SectionCard';
import { useDevices } from '@/hooks/useDevices';
import { useMedia } from '@/hooks/useMedia';
import { createDefaultSchedule, type Schedule } from '@/types/schedule.types';
import {
  type Event,
  type EventSettingsOverrides,
  type Settings,
} from '@/types/settings.types';
import { EditorQualityAssistant } from '@/components/EditorQualityAssistant';
import { getEventQualityIssues } from '@/utils/editorQuality';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Layers,
  MonitorSmartphone,
  Music2,
  Palette,
  Plus,
  Save,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import {
  buildPersistedEvent,
  buildPreviewEvent,
  createBlankEvent,
  createEventDraftFromEvent,
  getEventBounds,
  getStepValidationMessage,
  mergeOverridePatch,
  normalizeOverrides,
  sanitizeTargetDeviceIds,
  type EventDraft,
} from './eventManager.utils';
import {
  BasicsStep,
  TimingStep,
  DeliveryStep,
  SlideshowStep,
  DesignStep,
  AudioStep,
  PreviewStep,
} from './EventWizardSteps';
import { EventListCard } from './EventListCard';

interface EventManagerProps {
  events: Event[];
  settings: Settings;
  schedule?: Schedule | null;
  onChange: (events: Event[]) => void;
}

type AssistantMode = 'idle' | 'create' | 'edit';

const ASSISTANT_STEPS = [
  { id: 'basics', label: 'Basis', icon: Wand2 },
  { id: 'timing', label: 'Zeitraum', icon: Calendar },
  { id: 'delivery', label: 'Ausspielung', icon: MonitorSmartphone },
  { id: 'slideshow', label: 'Slideshow', icon: Layers },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'audio', label: 'Audio', icon: Music2 },
  { id: 'preview', label: 'Vorschau', icon: Sparkles },
] as const;

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

  const stepValidationMessage = useMemo(
    () => getStepValidationMessage(ASSISTANT_STEPS[stepIndex]?.id, normalizedFormData, isTimeRangeValid, canSave),
    [canSave, isTimeRangeValid, normalizedFormData, stepIndex],
  );

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
    setFormData(createEventDraftFromEvent(event));
    setAssistantMode('edit');
    setEditingId(event.id);
    setStepIndex(0);
  };

  const handleSave = () => {
    if (!canSave) return;

    const nextEvent = buildPersistedEvent(editingId, normalizedFormData);

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
    setFormData((prev) => ({
      ...prev,
      settingsOverrides: mergeOverridePatch(prev.settingsOverrides, patch),
    }));
  };

  const currentStep = ASSISTANT_STEPS[stepIndex];
  const currentStepId = currentStep.id;

  const stepProps = { formData, normalizedFormData, setFormData, updateOverrides };

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

            {currentStepId === 'basics' && <BasicsStep {...stepProps} />}
            {currentStepId === 'timing' && <TimingStep {...stepProps} />}
            {currentStepId === 'delivery' && <DeliveryStep {...stepProps} pairedDevices={pairedDevices} />}
            {currentStepId === 'slideshow' && (
              <SlideshowStep
                {...stepProps}
                settings={settings}
                previewSchedule={previewSchedule}
                previewSettings={previewSettings}
                effectivePrestartMinutes={effectivePrestartMinutes}
              />
            )}
            {currentStepId === 'design' && <DesignStep {...stepProps} />}
            {currentStepId === 'audio' && <AudioStep {...stepProps} />}
            {currentStepId === 'preview' && (
              <PreviewStep
                {...stepProps}
                previewEvent={previewEvent}
                previewSchedule={previewSchedule}
                previewSettings={previewSettings}
                pairedDevices={pairedDevices}
                selectedTargetDevices={selectedTargetDevices}
                selectedTargetDeviceIds={selectedTargetDeviceIds}
                previewTargetLabel={previewTargetLabel}
                startDateTime={startDateTime}
              />
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

      <EventListCard
        events={events}
        onEdit={handleStartEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
      />
    </div>
  );
}
