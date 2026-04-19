import type {
  EventsPanelData,
  InfoPanelData,
  MediaImageData,
  MediaVideoData,
  SaunaDetailData,
  SchedulePanelData,
  SchedulePanelStyle,
  SaunaDetailStyle,
  SlideRendererProps,
  SlideTypeId,
} from '@htmlsignage/design-sdk';

/**
 * Deterministic fixture data. Fixed UUIDs / timestamps / UA so nothing
 * drifts between runs. Uses a "day is Tuesday 14:30" world so the
 * status flags on the schedule produce a readable mix of VORBEI /
 * LÄUFT / GLEICH / upcoming entries.
 */

export const FIXTURE_NOW_ISO = '2024-05-14T14:30:00.000Z';

export const FIXED_VIEWPORT = {
  width: 1280,
  height: 720,
  isNarrow: false,
  isShort: false,
  isCompact: false,
  isUltraCompact: false,
} as const;

export const COMPACT_VIEWPORT = {
  width: 420,
  height: 540,
  isNarrow: true,
  isShort: false,
  isCompact: false,
  isUltraCompact: false,
} as const;

export function buildContext<T extends SlideTypeId>(
  overrides: Partial<SlideRendererProps<T>['context']> = {},
): SlideRendererProps<T>['context'] {
  return {
    zoneId: 'left',
    durationMs: 12_000,
    transitionsEnabled: true,
    locale: 'de-DE',
    deviceId: 'device-fixture',
    viewport: FIXED_VIEWPORT,
    ...overrides,
  };
}

// ─── Schedule panel ─────────────────────────────────────────────────────────

const SAUNAS: SchedulePanelData['saunas'] = [
  { id: 'aufguss', name: 'Aufgusssauna', color: '#8B5A2B', temperatureC: 90 },
  { id: 'finnisch', name: 'Finnische Sauna', color: '#4F6D7A', temperatureC: 90 },
  { id: 'kelo', name: 'Kelosauna', color: '#7A3E2F', temperatureC: 85 },
  { id: 'dampf', name: 'Dampfbad', color: '#5A7FA3', temperatureC: 60, outOfOrder: false },
  { id: 'fenster', name: 'Fenster zur Welt', color: '#D4A574', temperatureC: 90 },
];

const TIME_SLOTS = [
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '14:30',
  '15:30',
  '16:30',
  '18:00',
];

export function buildSchedulePanelData(
  styleHint: SchedulePanelStyle = 'list',
): SchedulePanelData {
  // Cells: [saunaIdx][slotIdx]. Fill a believable mix of occupied and
  // empty cells so the renderer's layout branches are exercised.
  const cells: SchedulePanelData['cells'] = [
    [
      null,
      null,
      { title: 'Fruchtoase', time: '13:00', durationMin: 15, intensity: 2, isLive: false, isNext: false, isFinished: true, isPrestart: false, aromas: [{ id: 'limette', name: 'Limette', emoji: '🍋', color: '#B8910C' }] },
      null,
      { title: 'Vulkan', time: '14:30', durationMin: 15, intensity: 4, isLive: true, isNext: false, isFinished: false, isPrestart: false },
      null,
      { title: 'Überraschung', time: '16:30', durationMin: 15, intensity: 2, isLive: false, isNext: true, isFinished: false, isPrestart: false },
      { title: 'Ice on Fire', time: '18:00', durationMin: 15, intensity: 4, isLive: false, isNext: false, isFinished: false, isPrestart: false, aromas: [{ id: 'menthol', name: 'Menthol', emoji: '❄️', color: '#4FB1C8' }] },
    ],
    [
      { title: 'Guten Morgen', time: '11:00', durationMin: 15, intensity: 2, isLive: false, isNext: false, isFinished: true, isPrestart: false },
      null,
      null,
      { title: 'Kleine Auszeit', time: '14:00', durationMin: 15, intensity: 2, isLive: false, isNext: false, isFinished: true, isPrestart: false, aromas: [{ id: 'grapefruit', name: 'Grapefruit', emoji: '🍊', color: '#E77F3B' }, { id: 'salbei', name: 'Salbei', emoji: '🌿', color: '#6DAA6D' }] },
      null,
      null,
      null,
      null,
    ],
    [
      null,
      { title: 'Waldauszeit', time: '12:00', durationMin: 15, intensity: 2, isLive: false, isNext: false, isFinished: true, isPrestart: false },
      null,
      null,
      null,
      null,
      null,
      null,
    ],
    [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
    [
      null,
      null,
      null,
      null,
      null,
      { title: 'Durchatmen', time: '15:30', durationMin: 15, intensity: 2, isLive: false, isPrestart: true, isNext: false, isFinished: false },
      null,
      null,
    ],
  ];

  return {
    saunas: SAUNAS,
    timeSlots: TIME_SLOTS,
    cells,
    generatedAt: FIXTURE_NOW_ISO,
    styleHint,
  };
}

// ─── Sauna detail ───────────────────────────────────────────────────────────

export function buildSaunaDetailData(
  styleHint: SaunaDetailStyle = 'split',
): SaunaDetailData {
  return {
    saunaId: 'aufguss',
    name: 'Aufgusssauna',
    subtitle: undefined,
    description:
      'Die Aufgusssauna ist das Herzstück unserer Saunawelt — klassisch finnisch mit wechselnden Aufgüssen und duftenden Aromen durch den Tag.',
    infoBadges: ['Klassisch finnisch', 'Aufgüsse stündlich'],
    accentColor: '#8B5A2B',
    imageUrl: 'https://example.test/fixture/aufgusssauna.jpg',
    info: { temperatureC: 90, humidityPct: 10, capacity: 24, features: ['Himalaya-Salz'] },
    upcoming: [
      {
        id: 'u1',
        time: '13:00',
        durationMin: 15,
        title: 'Fruchtoase',
        intensity: 2,
        aromas: [{ id: 'limette', name: 'Limette', emoji: '🍋', color: '#B8910C' }],
        isLive: false,
        isNext: false,
        isPrestart: false,
        isFinished: true,
      },
      {
        id: 'u2',
        time: '14:30',
        durationMin: 15,
        title: 'Vulkan',
        intensity: 4,
        aromas: [],
        isLive: true,
        isNext: false,
        isPrestart: false,
        isFinished: false,
      },
      {
        id: 'u3',
        time: '15:30',
        durationMin: 15,
        title: 'Durchatmen',
        intensity: 2,
        aromas: [{ id: 'menthol', name: 'Menthol', emoji: '❄️', color: '#4FB1C8' }],
        isLive: false,
        isNext: false,
        isPrestart: true,
        isFinished: false,
      },
      {
        id: 'u4',
        time: '16:30',
        durationMin: 15,
        title: 'Überraschung',
        intensity: 2,
        aromas: [],
        isLive: false,
        isNext: true,
        isPrestart: false,
        isFinished: false,
      },
      {
        id: 'u5',
        time: '18:00',
        durationMin: 15,
        title: 'Ice on Fire',
        intensity: 4,
        aromas: [{ id: 'menthol', name: 'Menthol', emoji: '❄️', color: '#4FB1C8' }],
        isLive: false,
        isNext: false,
        isPrestart: false,
        isFinished: false,
      },
    ],
    styleHint,
  };
}

// ─── Info panel ─────────────────────────────────────────────────────────────

export function buildInfoPanelData(): InfoPanelData {
  return {
    id: 'info-abkuehlung',
    title: 'Abkühlung',
    text:
      'Nutzen Sie nach dem Saunagang unsere Kaltwasserbecken für den perfekten Kreislauf-Kick.\n\nBitte vor dem Eintauchen duschen.',
    imageUrl: 'https://example.test/fixture/abkuehlung.jpg',
    imageMode: 'side',
    accentColor: '#5A6B4D',
  };
}

// ─── Events panel ───────────────────────────────────────────────────────────

export function buildEventsPanelData(): EventsPanelData {
  return {
    events: [
      {
        id: 'e1',
        title: 'Mitternachts-Aufguss',
        startsAt: '2024-05-17T23:00:00.000Z',
        endsAt: '2024-05-18T01:00:00.000Z',
        location: 'Aufgusssauna',
        description: 'Langer Aufguss mit DJ und Lichtshow.',
        imageUrl: null,
        statusRank: 'soon',
        isLive: false,
        startsSoon: false,
        dateLabel: 'Fr. 17. Mai',
        timeLabel: '23:00 – 01:00',
        relativeLabel: 'In 3 Tagen',
      },
      {
        id: 'e2',
        title: 'Sommer-Open-Air',
        startsAt: '2024-06-21T19:00:00.000Z',
        endsAt: '2024-06-21T23:00:00.000Z',
        location: 'Außenbereich',
        imageUrl: null,
        statusRank: 'near',
        isLive: false,
        startsSoon: false,
        dateLabel: 'Fr. 21. Juni',
        timeLabel: '19:00 – 23:00',
        relativeLabel: 'In 5 Wochen',
      },
      {
        id: 'e3',
        title: 'Ruhetag',
        startsAt: '2024-08-01T06:00:00.000Z',
        endsAt: '2024-08-01T22:00:00.000Z',
        imageUrl: null,
        statusRank: 'far',
        isLive: false,
        startsSoon: false,
        dateLabel: 'Do. 1. Aug.',
        timeLabel: 'Ganztags',
        relativeLabel: 'Im August',
      },
    ],
    generatedAt: FIXTURE_NOW_ISO,
  };
}

// ─── Media ──────────────────────────────────────────────────────────────────

export function buildMediaImageData(): MediaImageData {
  return {
    mediaId: 'media-1',
    url: 'https://example.test/fixture/spa-image.jpg',
    altText: 'Spa-Ambiente',
    fit: 'cover',
    title: 'Unsere Saunawelt',
    showTitle: true,
  };
}

export function buildMediaVideoData(): MediaVideoData {
  return {
    mediaId: 'media-2',
    url: 'https://example.test/fixture/spa-video.mp4',
    fit: 'cover',
    playback: 'complete',
    mutedByDefault: true,
    title: 'Saunaritual',
    showTitle: true,
  };
}
