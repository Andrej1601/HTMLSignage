import type { Event } from '@/types/settings.types';

export type EventDraft = Omit<Event, 'id'>;

export function formatDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function createBlankEvent(): EventDraft {
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
    slideshowId: undefined,
  };
}

export function sanitizeTargetDeviceIds(raw?: string[]): string[] | undefined {
  const values = Array.isArray(raw)
    ? Array.from(new Set(raw.map((value) => String(value).trim()).filter(Boolean)))
    : [];
  return values.length > 0 ? values : undefined;
}

export function getEventBounds(event: Pick<EventDraft, 'startDate' | 'startTime' | 'endDate' | 'endTime'>): {
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

export function buildPreviewEvent(draft: EventDraft, editingId: string | null): Event {
  return {
    id: editingId || 'event-preview',
    ...draft,
    name: draft.name.trim() || 'Event-Vorschau',
    description: draft.description?.trim() || undefined,
    endDate: draft.endDate || draft.startDate,
    endTime: draft.endTime || '23:59',
    isActive: true,
    targetDeviceIds: sanitizeTargetDeviceIds(draft.targetDeviceIds),
    slideshowId: draft.slideshowId,
  };
}

export function buildPersistedEvent(editingId: string | null, draft: EventDraft): Event {
  return {
    id: editingId || `${Date.now()}`,
    ...draft,
    name: draft.name.trim(),
    description: draft.description?.trim() || undefined,
    targetDeviceIds: sanitizeTargetDeviceIds(draft.targetDeviceIds),
    slideshowId: draft.slideshowId,
  };
}

export function createEventDraftFromEvent(event: Event): EventDraft {
  return {
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
    slideshowId: event.slideshowId,
  };
}

export function formatEventWindow(event: Pick<Event, 'startDate' | 'startTime' | 'endDate' | 'endTime'>): string {
  const start = new Date(`${event.startDate}T${event.startTime}`);
  const endDate = event.endDate || event.startDate;
  const endTime = event.endTime || '23:59';
  const end = new Date(`${endDate}T${endTime}`);

  const startLabel = start.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const endLabel = end.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return `${startLabel} bis ${endLabel}`;
}

export function sortEventsByStartDesc(events: Event[]): Event[] {
  return [...events].sort((a, b) => {
    const aStart = new Date(`${a.startDate}T${a.startTime}`).getTime();
    const bStart = new Date(`${b.startDate}T${b.startTime}`).getTime();
    return bStart - aStart;
  });
}

export function getStepValidationMessage(
  currentStepId: string | undefined,
  draft: EventDraft,
  isTimeRangeValid: boolean,
  canSave: boolean,
): string | null {
  if (currentStepId === 'basics' && !draft.name.trim()) {
    return 'Bitte vergeben Sie zuerst einen Event-Namen.';
  }

  if (currentStepId === 'timing') {
    if (!draft.startDate || !draft.startTime) {
      return 'Bitte definieren Sie Startdatum und Startzeit.';
    }
    if (!isTimeRangeValid) {
      return 'Das Event-Ende muss nach dem Start liegen.';
    }
  }

  if (currentStepId === 'slideshow' && !canSave) {
    return 'Für die Slideshow-Auswahl fehlt noch ein vollständiger Event-Zeitraum.';
  }

  return null;
}

export function toggleTargetDeviceId(current: string[] | undefined, deviceId: string): string[] | undefined {
  const nextValues = new Set(current || []);
  if (nextValues.has(deviceId)) nextValues.delete(deviceId);
  else nextValues.add(deviceId);

  return nextValues.size > 0 ? Array.from(nextValues) : undefined;
}
