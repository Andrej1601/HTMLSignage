import type {
  Event,
  EventSettingsOverrides,
} from '@/types/settings.types';

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
    settingsOverrides: undefined,
  };
}

export function normalizeOverrides(raw?: EventSettingsOverrides): EventSettingsOverrides | undefined {
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
    settingsOverrides: normalizeOverrides(draft.settingsOverrides),
  };
}

export function buildPersistedEvent(editingId: string | null, draft: EventDraft): Event {
  return {
    id: editingId || `${Date.now()}`,
    ...draft,
    name: draft.name.trim(),
    description: draft.description?.trim() || undefined,
    targetDeviceIds: sanitizeTargetDeviceIds(draft.targetDeviceIds),
    settingsOverrides: normalizeOverrides(draft.settingsOverrides),
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
    settingsOverrides: normalizeOverrides(event.settingsOverrides),
  };
}

export function formatEventWindow(event: Pick<Event, 'startDate' | 'startTime' | 'endDate' | 'endTime'>): string {
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

  if (currentStepId === 'preview' && !canSave) {
    return 'Für die Vorschau fehlt noch ein vollständiger und gültiger Event-Zeitraum.';
  }

  return null;
}

export function mergeOverridePatch(
  current: EventSettingsOverrides | undefined,
  patch: Partial<EventSettingsOverrides>,
): EventSettingsOverrides | undefined {
  const merged: EventSettingsOverrides = {
    ...(current || {}),
    ...patch,
  };

  if ('audio' in patch && !patch.audio) delete merged.audio;
  if ('displayAppearance' in patch && !patch.displayAppearance) delete merged.displayAppearance;
  if ('designStyle' in patch && !patch.designStyle) delete merged.designStyle;
  if ('colorPalette' in patch && !patch.colorPalette) delete merged.colorPalette;

  return normalizeOverrides(merged);
}

export function toggleTargetDeviceId(current: string[] | undefined, deviceId: string): string[] | undefined {
  const nextValues = new Set(current || []);
  if (nextValues.has(deviceId)) nextValues.delete(deviceId);
  else nextValues.add(deviceId);

  return nextValues.size > 0 ? Array.from(nextValues) : undefined;
}
