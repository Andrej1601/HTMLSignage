import type { Media } from '@/types/media.types';
import {
  PRESET_LABELS,
  normalizeSaunaNameKey,
  type DaySchedule,
  type PresetKey,
  type Schedule,
} from '@/types/schedule.types';
import {
  getEnabledSlides,
  getSlideTypeOption,
  getSlidesByZone,
  getZonesForLayout,
  type SlideConfig,
  type SlideshowConfig,
} from '@/types/slideshow.types';
import type { Device } from '@/types/device.types';
import type { AudioSettings, Event, Settings } from '@/types/settings.types';
import { normalizeAudioSettings } from '@/utils/audioUtils';
import type { StatusTone } from '@/components/StatusBadge';

export type EditorQualityTone = Exclude<StatusTone, 'neutral'>;

export interface EditorQualityIssue {
  id: string;
  tone: EditorQualityTone;
  title: string;
  detail: string;
  fixLabel?: string;
}

export interface QualityEventDraft {
  id?: string;
  name: string;
  description?: string;
  imageId?: string;
  startDate: string;
  startTime: string;
  endDate?: string;
  endTime?: string;
  assignedPreset: Event['assignedPreset'];
  isActive: boolean;
  targetDeviceIds?: string[];
  settingsOverrides?: Event['settingsOverrides'];
}

function sortIssues(issues: EditorQualityIssue[]): EditorQualityIssue[] {
  const rank: Record<EditorQualityTone, number> = {
    danger: 0,
    warning: 1,
    info: 2,
    success: 3,
  };

  return [...issues].sort((a, b) => rank[a.tone] - rank[b.tone] || a.title.localeCompare(b.title, 'de-DE'));
}

function normalizeTargetIds(targets?: string[]): string[] {
  return Array.isArray(targets)
    ? Array.from(new Set(targets.map((value) => String(value).trim()).filter(Boolean)))
    : [];
}

function rowHasContent(row: DaySchedule['rows'][number]): boolean {
  return (row.entries || []).some((entry) => {
    if (!entry) return false;
    return Boolean(
      entry.title?.trim() ||
      entry.subtitle?.trim() ||
      entry.description?.trim() ||
      entry.notes?.trim() ||
      entry.badges?.length ||
      entry.flames ||
      entry.duration,
    );
  });
}

function getDayScheduleStats(daySchedule?: DaySchedule | null) {
  if (!daySchedule) {
    return {
      rowCount: 0,
      emptyRows: 0,
      inconsistentRows: 0,
      duplicateTimeRows: 0,
      filledRows: 0,
    };
  }

  let emptyRows = 0;
  let inconsistentRows = 0;
  let duplicateTimeRows = 0;
  let filledRows = 0;
  const seenTimes = new Set<string>();

  for (const row of daySchedule.rows) {
    const hasContent = rowHasContent(row);
    if (hasContent) filledRows += 1;
    else emptyRows += 1;

    if ((row.entries?.length || 0) !== daySchedule.saunas.length) {
      inconsistentRows += 1;
    }

    if (seenTimes.has(row.time)) duplicateTimeRows += 1;
    else seenTimes.add(row.time);
  }

  return {
    rowCount: daySchedule.rows.length,
    emptyRows,
    inconsistentRows,
    duplicateTimeRows,
    filledRows,
  };
}

function hasSauna(settings: Settings | null | undefined, saunaId?: string): boolean {
  if (!saunaId) return false;
  const normalizedId = normalizeSaunaNameKey(saunaId);
  return Boolean(
    settings?.saunas?.some((sauna) => (
      sauna.id === saunaId ||
      sauna.name === saunaId ||
      normalizeSaunaNameKey(sauna.name) === normalizedId
    )),
  );
}

function getMediaItem(media: Media[], mediaId?: string) {
  if (!mediaId) return null;
  return media.find((item) => item.id === mediaId) || null;
}

function hasMissingAudioSource(audio: AudioSettings | null | undefined, media: Media[]): {
  missing: boolean;
  wrongType: boolean;
} {
  if (!audio) return { missing: false, wrongType: false };
  const normalized = normalizeAudioSettings(audio);

  if (!normalized.enabled) {
    return { missing: false, wrongType: false };
  }

  if (normalized.mediaId) {
    const mediaItem = getMediaItem(media, normalized.mediaId);
    if (!mediaItem) return { missing: true, wrongType: false };
    return { missing: false, wrongType: mediaItem.type !== 'audio' };
  }

  if (normalized.src) {
    return { missing: false, wrongType: false };
  }

  return { missing: true, wrongType: false };
}

export function getScheduleQualityIssues({
  schedule,
  presetKey,
  settings,
}: {
  schedule?: Schedule | null;
  presetKey: PresetKey;
  settings?: Settings | null;
}): EditorQualityIssue[] {
  if (!schedule) return [];

  const issues: EditorQualityIssue[] = [];
  const currentPreset = schedule.presets[presetKey];
  const currentStats = getDayScheduleStats(currentPreset);
  const linkedEvents = (settings?.events || []).filter(
    (event) => event.isActive && event.assignedPreset === presetKey,
  );

  if (currentPreset.saunas.length === 0) {
    issues.push({
      id: 'schedule-no-saunas',
      tone: 'danger',
      title: 'Diesem Preset fehlen Sauna-Spalten',
      detail: `${PRESET_LABELS[presetKey]} hat aktuell keine zugeordneten Saunen und kann nicht sinnvoll ausgespielt werden.`,
      fixLabel: 'Sauna-Konfiguration in den Einstellungen prüfen und den Plan neu laden.',
    });
  }

  if (currentStats.rowCount === 0) {
    issues.push({
      id: 'schedule-no-rows',
      tone: linkedEvents.length > 0 ? 'danger' : 'warning',
      title: `${PRESET_LABELS[presetKey]} enthält noch keine Zeitzeilen`,
      detail: linkedEvents.length > 0
        ? `${linkedEvents.length} aktive(s) Event(s) verweisen bereits auf dieses Preset.`
        : 'Ohne Zeitzeilen kann dieses Preset noch nichts ausspielen.',
      fixLabel: 'Zeilen hinzufügen oder ein bestehendes Tagespreset übernehmen.',
    });
  } else if (currentStats.filledRows === 0) {
    issues.push({
      id: 'schedule-no-filled-rows',
      tone: linkedEvents.length > 0 ? 'danger' : 'warning',
      title: 'Alle Zeitzeilen sind noch leer',
      detail: `${PRESET_LABELS[presetKey]} hat ${currentStats.rowCount} Zeile${currentStats.rowCount === 1 ? '' : 'n'}, aber noch keinen befüllten Inhalt.`,
      fixLabel: 'Mindestens die relevanten Slots mit Aufgussdaten füllen.',
    });
  } else if (currentStats.emptyRows > 0) {
    issues.push({
      id: 'schedule-empty-rows',
      tone: 'warning',
      title: `${currentStats.emptyRows} leere Zeitzeile${currentStats.emptyRows === 1 ? '' : 'n'} im aktuellen Preset`,
      detail: 'Leere Zeilen erzeugen unnötige Leerstellen im Redaktionsablauf und erschweren die Planpflege.',
      fixLabel: 'Leere Slots befüllen oder die Zeilen entfernen.',
    });
  }

  if (currentStats.duplicateTimeRows > 0) {
    issues.push({
      id: 'schedule-duplicate-times',
      tone: 'danger',
      title: `${currentStats.duplicateTimeRows} doppelte Zeit${currentStats.duplicateTimeRows === 1 ? '' : 'en'} erkannt`,
      detail: `In ${PRESET_LABELS[presetKey]} gibt es mehrere Zeilen mit derselben Uhrzeit.`,
      fixLabel: 'Doppelte Zeitslots zusammenführen oder Zeiten eindeutig korrigieren.',
    });
  }

  if (currentStats.inconsistentRows > 0) {
    issues.push({
      id: 'schedule-inconsistent-rows',
      tone: 'danger',
      title: `${currentStats.inconsistentRows} Zeile${currentStats.inconsistentRows === 1 ? '' : 'n'} passen nicht zur Sauna-Struktur`,
      detail: 'Mindestens eine Zeile hat mehr oder weniger Einträge als aktuell konfigurierte Saunen.',
      fixLabel: 'Zeilen prüfen oder die Sauna-Synchronisierung erneut anwenden.',
    });
  }

  let otherPresetProblems = 0;
  for (const [key, preset] of Object.entries(schedule.presets) as [PresetKey, DaySchedule][]) {
    if (key === presetKey) continue;
    const stats = getDayScheduleStats(preset);
    otherPresetProblems += stats.emptyRows + stats.inconsistentRows + stats.duplicateTimeRows;
  }

  if (otherPresetProblems > 0) {
    issues.push({
      id: 'schedule-other-presets',
      tone: 'info',
      title: 'Weitere Planprobleme außerhalb des aktuellen Presets',
      detail: `In anderen Presets gibt es zusammen ${otherPresetProblems} offene Auffälligkeit${otherPresetProblems === 1 ? '' : 'en'}.`,
      fixLabel: 'Nach diesem Preset auch die übrigen Tages- und Eventpläne durchgehen.',
    });
  }

  return sortIssues(issues);
}

function getSlideIssue({
  slide,
  media,
  settings,
}: {
  slide: SlideConfig;
  media: Media[];
  settings: Settings | null | undefined;
}): EditorQualityIssue | null {
  const typeMeta = getSlideTypeOption(slide.type);

  if (typeMeta?.requiresSauna && !slide.saunaId) {
    return {
      id: `slide-sauna-missing-${slide.id}`,
      tone: 'danger',
      title: `Slide "${slide.title || typeMeta.label}" hat keine Sauna`,
      detail: 'Sauna-Detail-Slides benötigen eine gültige Sauna-Zuordnung.',
      fixLabel: 'Im Slide-Editor eine Sauna auswählen.',
    };
  }

  if (slide.type === 'sauna-detail' && slide.saunaId && !hasSauna(settings, slide.saunaId)) {
    return {
      id: `slide-sauna-invalid-${slide.id}`,
      tone: 'danger',
      title: `Sauna-Referenz für "${slide.title || typeMeta?.label || 'Slide'}" ist veraltet`,
      detail: 'Die referenzierte Sauna existiert in den aktuellen Einstellungen nicht mehr.',
      fixLabel: 'Slide öffnen und eine vorhandene Sauna zuweisen.',
    };
  }

  if (typeMeta?.requiresMedia && !slide.mediaId) {
    return {
      id: `slide-media-missing-${slide.id}`,
      tone: 'danger',
      title: `Slide "${slide.title || typeMeta.label}" hat kein Medium`,
      detail: `${typeMeta.label} benötigt einen gültigen Eintrag aus der Mediathek.`,
      fixLabel: 'Im Slide-Editor ein passendes Medium auswählen.',
    };
  }

  if (slide.mediaId) {
    const mediaItem = getMediaItem(media, slide.mediaId);
    if (!mediaItem) {
      return {
        id: `slide-media-stale-${slide.id}`,
        tone: 'danger',
        title: `Medienreferenz für "${slide.title || typeMeta?.label || 'Slide'}" fehlt`,
        detail: 'Das verknüpfte Medium wurde gelöscht oder ist nicht mehr verfügbar.',
        fixLabel: 'Ein neues Medium auswählen oder den Slide entfernen.',
      };
    }

    if (slide.type === 'media-image' && mediaItem.type !== 'image') {
      return {
        id: `slide-media-image-type-${slide.id}`,
        tone: 'danger',
        title: `"${slide.title || typeMeta?.label || 'Slide'}" verweist nicht auf ein Bild`,
        detail: `Aktuell ist ${mediaItem.originalName} vom Typ ${mediaItem.type} verknüpft.`,
        fixLabel: 'Ein Bild auswählen oder den Slide-Typ anpassen.',
      };
    }

    if (slide.type === 'media-video' && mediaItem.type !== 'video') {
      return {
        id: `slide-media-video-type-${slide.id}`,
        tone: 'danger',
        title: `"${slide.title || typeMeta?.label || 'Slide'}" verweist nicht auf ein Video`,
        detail: `Aktuell ist ${mediaItem.originalName} vom Typ ${mediaItem.type} verknüpft.`,
        fixLabel: 'Ein Video auswählen oder den Slide-Typ anpassen.',
      };
    }
  }

  if (slide.type === 'infos' && (settings?.infos?.length || 0) === 0) {
    return {
      id: `slide-infos-empty-${slide.id}`,
      tone: 'warning',
      title: 'Info-Slide ohne gepflegte Info-Inhalte',
      detail: 'In den Einstellungen sind aktuell keine Info-Karten hinterlegt.',
      fixLabel: 'Im Bereich Infos zuerst mindestens einen Inhalt anlegen.',
    };
  }

  if (slide.type === 'events' && (settings?.events?.length || 0) === 0) {
    return {
      id: `slide-events-empty-${slide.id}`,
      tone: 'warning',
      title: 'Event-Slide ohne gepflegte Events',
      detail: 'Die Event-Fläche bleibt wenig aussagekräftig, solange keine Events vorbereitet sind.',
      fixLabel: 'Im Event-Manager mindestens ein Event anlegen oder den Slide entfernen.',
    };
  }

  return null;
}

export function getSlideshowQualityIssues({
  config,
  settings,
  media,
  audioOverride,
}: {
  config?: SlideshowConfig | null;
  settings?: Settings | null;
  media?: Media[];
  audioOverride?: AudioSettings | null;
}): EditorQualityIssue[] {
  if (!config) return [];

  const issues: EditorQualityIssue[] = [];
  const safeMedia = media || [];
  const enabledSlides = getEnabledSlides(config);

  if (config.slides.length === 0) {
    issues.push({
      id: 'slideshow-no-slides',
      tone: 'danger',
      title: 'Diese Slideshow enthält noch keine Slides',
      detail: 'Ohne Slides gibt es für dieses Ziel nichts ausspielbares.',
      fixLabel: 'Mindestens einen Slide anlegen und aktivieren.',
    });
  } else if (enabledSlides.length === 0) {
    issues.push({
      id: 'slideshow-no-enabled-slides',
      tone: 'danger',
      title: 'Alle vorhandenen Slides sind deaktiviert',
      detail: 'Die Konfiguration hat Inhalte, aber aktuell keinen aktiven Slide für die Ausspielung.',
      fixLabel: 'Mindestens einen Slide aktivieren.',
    });
  }

  const zones = getZonesForLayout(config.layout);
  const emptyZones = zones.filter((zone) => getSlidesByZone(enabledSlides, zone.id).length === 0);

  if (enabledSlides.length > 0 && emptyZones.length > 0) {
    issues.push({
      id: 'slideshow-empty-zones',
      tone: 'warning',
      title: `${emptyZones.length} Layout-Zone${emptyZones.length === 1 ? '' : 'n'} ohne aktiven Inhalt`,
      detail: `Leer sind aktuell: ${emptyZones.map((zone) => zone.name).join(', ')}.`,
      fixLabel: 'Pro Zone mindestens einen passenden Slide zuweisen oder das Layout vereinfachen.',
    });
  }

  for (const slide of enabledSlides) {
    const issue = getSlideIssue({ slide, media: safeMedia, settings });
    if (issue) issues.push(issue);
  }

  const audioState = hasMissingAudioSource(audioOverride, safeMedia);
  if (audioState.missing || audioState.wrongType) {
    issues.push({
      id: 'slideshow-audio-missing',
      tone: 'danger',
      title: 'Audio-Override ist aktiv, aber nicht ausspielbar',
      detail: audioState.wrongType
        ? 'Das gewählte Medium ist kein Audio-Asset.'
        : 'Es fehlt entweder eine Datei aus der Mediathek oder eine direkte Audio-Quelle.',
      fixLabel: 'Im Audio-Override eine gültige Audiodatei auswählen oder Audio deaktivieren.',
    });
  }

  return sortIssues(issues);
}

function getEventBounds(event: Pick<QualityEventDraft, 'startDate' | 'startTime' | 'endDate' | 'endTime'>): {
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

function targetScopesOverlap(aTargets?: string[], bTargets?: string[]): boolean {
  const a = normalizeTargetIds(aTargets);
  const b = normalizeTargetIds(bTargets);

  if (a.length === 0 || b.length === 0) return true;
  return a.some((id) => b.includes(id));
}

function formatTargetLabel(targetIds: string[], devices: Device[]): string {
  if (targetIds.length === 0) return 'alle Geräte';
  const names = devices
    .filter((device) => targetIds.includes(device.id))
    .map((device) => device.name);

  if (names.length === 0) return `${targetIds.length} Gerät${targetIds.length === 1 ? '' : 'e'}`;
  if (names.length === 1) return names[0];
  return `${names.length} Geräte`;
}

function collectSingleEventIssues({
  event,
  media,
  schedule,
  devices,
}: {
  event: QualityEventDraft;
  media: Media[];
  schedule?: Schedule | null;
  devices: Device[];
}): EditorQualityIssue[] {
  const issues: EditorQualityIssue[] = [];
  const name = event.name.trim() || 'Event-Entwurf';
  const bounds = getEventBounds(event);
  const targetIds = normalizeTargetIds(event.targetDeviceIds);
  const missingTargetIds = targetIds.filter((id) => !devices.some((device) => device.id === id));

  if (!event.name.trim()) {
    issues.push({
      id: `event-name-${event.id || 'draft'}`,
      tone: 'warning',
      title: 'Dem Event fehlt noch ein Name',
      detail: 'Ohne Namen ist das Event in Listen, Vorschauen und Warnungen schwer zuzuordnen.',
      fixLabel: 'Im ersten Schritt einen sprechenden Event-Namen vergeben.',
    });
  }

  if (!bounds.start) {
    issues.push({
      id: `event-start-${event.id || 'draft'}`,
      tone: 'danger',
      title: `"${name}" hat keinen gültigen Start`,
      detail: 'Startdatum oder Startzeit fehlen bzw. sind ungültig.',
      fixLabel: 'Startdatum und Startzeit vollständig definieren.',
    });
  } else if (!bounds.end || bounds.start.getTime() > bounds.end.getTime()) {
    issues.push({
      id: `event-range-${event.id || 'draft'}`,
      tone: 'danger',
      title: `"${name}" hat ein ungültiges Zeitfenster`,
      detail: 'Das Event-Ende liegt vor dem Start oder ist nicht lesbar.',
      fixLabel: 'Enddatum und Endzeit so setzen, dass das Zeitfenster korrekt ist.',
    });
  }

  if (missingTargetIds.length > 0) {
    issues.push({
      id: `event-targets-${event.id || 'draft'}`,
      tone: 'warning',
      title: `"${name}" referenziert nicht mehr vorhandene Geräte`,
      detail: `${missingTargetIds.length} Zielgerät${missingTargetIds.length === 1 ? '' : 'e'} existiert nicht mehr in der aktuellen Flotte.`,
      fixLabel: 'Zielgeräte prüfen oder das Event wieder global ausspielen.',
    });
  }

  if (event.imageId) {
    const image = getMediaItem(media, event.imageId);
    if (!image) {
      issues.push({
        id: `event-image-missing-${event.id || 'draft'}`,
        tone: 'warning',
        title: `"${name}" nutzt ein fehlendes Event-Bild`,
        detail: 'Das referenzierte Bild wurde gelöscht oder ist nicht mehr vorhanden.',
        fixLabel: 'Ein anderes Bild auswählen oder das Bild entfernen.',
      });
    } else if (image.type !== 'image') {
      issues.push({
        id: `event-image-type-${event.id || 'draft'}`,
        tone: 'warning',
        title: `"${name}" nutzt kein Bild-Asset`,
        detail: `Aktuell ist ${image.originalName} vom Typ ${image.type} verknüpft.`,
        fixLabel: 'Ein Bild aus der Mediathek auswählen.',
      });
    }
  }

  const preset = schedule?.presets[event.assignedPreset];
  const presetStats = getDayScheduleStats(preset);
  if (!preset || presetStats.rowCount === 0 || presetStats.filledRows === 0) {
    issues.push({
      id: `event-preset-empty-${event.id || 'draft'}`,
      tone: 'warning',
      title: `"${name}" verweist auf einen leeren Event-Plan`,
      detail: `${PRESET_LABELS[event.assignedPreset]} hat aktuell noch keine nutzbaren Zeilen.`,
      fixLabel: 'Den zugewiesenen Event-Plan zuerst im Aufgussplan befüllen.',
    });
  }

  if (event.settingsOverrides?.slideshow) {
    const enabledSlides = getEnabledSlides(event.settingsOverrides.slideshow);
    if (enabledSlides.length === 0) {
      issues.push({
        id: `event-slideshow-empty-${event.id || 'draft'}`,
        tone: 'danger',
        title: `"${name}" hat eine leere Event-Slideshow`,
        detail: 'Es ist zwar ein Slideshow-Override aktiv, aber aktuell kein ausspielbarer Slide vorhanden.',
        fixLabel: 'Mindestens einen Event-Slide aktivieren oder den Override deaktivieren.',
      });
    }
  }

  const audioState = hasMissingAudioSource(event.settingsOverrides?.audio, media);
  if (audioState.missing || audioState.wrongType) {
    issues.push({
      id: `event-audio-${event.id || 'draft'}`,
      tone: 'danger',
      title: `"${name}" hat eine defekte Audio-Konfiguration`,
      detail: audioState.wrongType
        ? 'Das gewählte Medienobjekt ist kein Audio-Asset.'
        : 'Das Event-Audio ist aktiviert, aber Quelle oder Datei fehlen.',
      fixLabel: 'Im Audio-Schritt eine gültige Audiodatei auswählen oder Audio abschalten.',
    });
  }

  return issues;
}

export function getEventQualityIssues({
  events,
  devices,
  media,
  schedule,
  draft,
}: {
  events: Event[];
  devices?: Device[];
  media?: Media[];
  schedule?: Schedule | null;
  draft?: QualityEventDraft | null;
}): EditorQualityIssue[] {
  const safeDevices = devices || [];
  const safeMedia = media || [];
  const issues: EditorQualityIssue[] = [];

  if (draft) {
    issues.push(...collectSingleEventIssues({
      event: draft,
      media: safeMedia,
      schedule,
      devices: safeDevices,
    }));

    const draftBounds = getEventBounds(draft);
    if (draft.isActive && draftBounds.start && draftBounds.end) {
      const conflicting = events.find((event) => {
        if (draft.id && event.id === draft.id) return false;
        if (!event.isActive) return false;
        if (!targetScopesOverlap(draft.targetDeviceIds, event.targetDeviceIds)) return false;

        const otherBounds = getEventBounds(event);
        return Boolean(
          otherBounds.start &&
          otherBounds.end &&
          draftBounds.start &&
          draftBounds.end &&
          draftBounds.start.getTime() <= otherBounds.end.getTime() &&
          otherBounds.start.getTime() <= draftBounds.end.getTime(),
        );
      });

      if (conflicting) {
        issues.push({
          id: `event-overlap-${draft.id || 'draft'}-${conflicting.id}`,
          tone: 'warning',
          title: `Zeitfenster überschneidet sich mit "${conflicting.name}"`,
          detail: `Beide Events gelten für ${targetScopesOverlap(draft.targetDeviceIds, conflicting.targetDeviceIds) ? formatTargetLabel(normalizeTargetIds(draft.targetDeviceIds), safeDevices) : 'ähnliche Zielgruppen'}.`,
          fixLabel: 'Zeitfenster oder Zielgeräte trennen, damit keine Mehrdeutigkeit entsteht.',
        });
      }
    }

    return sortIssues(issues);
  }

  for (const event of events) {
    issues.push(...collectSingleEventIssues({
      event,
      media: safeMedia,
      schedule,
      devices: safeDevices,
    }));
  }

  for (let i = 0; i < events.length; i += 1) {
    for (let j = i + 1; j < events.length; j += 1) {
      const first = events[i];
      const second = events[j];
      if (!first.isActive || !second.isActive) continue;
      if (!targetScopesOverlap(first.targetDeviceIds, second.targetDeviceIds)) continue;

      const firstBounds = getEventBounds(first);
      const secondBounds = getEventBounds(second);
      if (!firstBounds.start || !firstBounds.end || !secondBounds.start || !secondBounds.end) continue;
      if (firstBounds.start.getTime() > secondBounds.end.getTime()) continue;
      if (secondBounds.start.getTime() > firstBounds.end.getTime()) continue;

      issues.push({
        id: `event-overlap-${first.id}-${second.id}`,
        tone: 'warning',
        title: `Event-Überlappung zwischen "${first.name}" und "${second.name}"`,
        detail: `Beide Events greifen zeitgleich auf ${formatTargetLabel(normalizeTargetIds(first.targetDeviceIds), safeDevices)} zu.`,
        fixLabel: 'Zeitfenster oder Zielgeräte der Events sauber voneinander trennen.',
      });
    }
  }

  return sortIssues(issues);
}
