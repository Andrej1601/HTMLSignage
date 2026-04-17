import type {
  EventsPanelData,
  InfoPanelData,
  MediaImageData,
  MediaVideoData,
  SaunaDetailData,
  SchedulePanelData,
  SlideRenderContext,
  SlideViewport,
} from '@htmlsignage/design-sdk';

/** Fixed wall-clock time so snapshots stay deterministic. */
export const FIXED_NOW = new Date('2026-05-15T15:32:00.000Z');

export const LANDSCAPE_VIEWPORT: SlideViewport = {
  width: 1920,
  height: 1080,
  isNarrow: false,
  isShort: false,
  isCompact: false,
  isUltraCompact: false,
};

export const DEFAULT_CONTEXT: SlideRenderContext = {
  zoneId: 'main',
  durationMs: 12000,
  transitionsEnabled: false,
  locale: 'de-DE',
  deviceId: 'fixture-device',
  viewport: LANDSCAPE_VIEWPORT,
};

// ─── Slide-data fixtures ─────────────────────────────────────────────────────

export const saunaDetailFixture: SaunaDetailData = {
  saunaId: 'sauna-aufguss',
  name: 'Aufgusssauna',
  subtitle: undefined,
  description: 'Zentrales Erlebnis — 90°C · 10% Luftfeuchte',
  infoBadges: ['90°C', '10% Luftfeuchte'],
  accentColor: '#8A1F78',
  imageUrl: 'https://example.test/media/aufguss.jpg',
  info: {
    temperatureC: 90,
    humidityPct: 10,
    capacity: 18,
    features: ['Aufguss stündlich', 'Kräuterduft'],
  },
  upcoming: [
    {
      id: 'a1',
      time: '13:00',
      durationMin: 15,
      title: 'Fruchtoase',
      description: undefined,
      intensity: 2,
      aromas: [{ id: 'lim', name: 'Limette', emoji: '🍋' }],
      isLive: false,
      isNext: false,
      isPrestart: false,
      isFinished: true,
    },
    {
      id: 'a2',
      time: '15:30',
      durationMin: 15,
      title: 'Vulkan',
      description: undefined,
      intensity: 4,
      aromas: [{ id: 'med', name: 'Saunamed', emoji: '❄️' }],
      isLive: true,
      isNext: false,
      isPrestart: false,
      isFinished: false,
    },
    {
      id: 'a3',
      time: '16:30',
      durationMin: 15,
      title: 'Überraschung',
      description: undefined,
      intensity: 2,
      aromas: [],
      isLive: false,
      isNext: true,
      isPrestart: false,
      isFinished: false,
    },
    {
      id: 'a4',
      time: '18:00',
      durationMin: 15,
      title: 'Ice on Fire',
      description: undefined,
      intensity: 3,
      aromas: [{ id: 'men', name: 'Menthol', emoji: '❄️' }],
      isLive: false,
      isNext: false,
      isPrestart: false,
      isFinished: false,
    },
  ],
};

export const schedulePanelFixture: SchedulePanelData = {
  saunas: [
    { id: 'sauna-aufguss', name: 'Aufgusssauna' },
    { id: 'sauna-finnisch', name: 'Finnische Sauna' },
    { id: 'sauna-kelo', name: 'Kelosauna' },
  ],
  timeSlots: ['11:00', '13:00', '15:30', '16:30', '18:00', '19:00', '21:00'],
  cells: [
    [
      null,
      { title: 'Fruchtoase', aromas: [{ id: 'lim', name: 'Limette' }], isLive: false, isNext: false },
      { title: 'Vulkan', aromas: [{ id: 'med', name: 'Saunamed' }], isLive: true, isNext: false },
      { title: 'Überraschung', isLive: false, isNext: true },
      { title: 'Ice on Fire', isLive: false, isNext: false },
      null,
      { title: 'Quittengeist', isLive: false, isNext: false },
    ],
    [
      { title: 'Guten Morgen', isLive: false, isNext: false },
      null,
      null,
      null,
      null,
      null,
      null,
    ],
    [
      null,
      { title: 'Waldauszeit', isLive: false, isNext: false },
      null,
      null,
      null,
      { title: 'Waldauszeit', isLive: false, isNext: false },
      null,
    ],
  ],
  generatedAt: FIXED_NOW.toISOString(),
};

export const infoPanelFixture: InfoPanelData = {
  id: 'abkuehlung',
  title: 'Abkühlung',
  text: 'Nutzen Sie nach dem Saunagang unsere Kaltwasserbecken für den perfekten Kreislauf-Kick.',
  imageUrl: null,
  imageMode: 'none',
};

export const eventsPanelFixture: EventsPanelData = {
  events: [
    {
      id: 'e1',
      title: 'winterweihnachtszauber',
      startsAt: '2026-05-30T10:00:00.000Z',
      endsAt: '2026-05-30T23:59:00.000Z',
      imageUrl: 'https://example.test/media/event-1.jpg',
      statusRank: 'far',
      isLive: false,
      startsSoon: false,
      dateLabel: 'Sa., 30. Mai',
      timeLabel: '10:00 – 23:59',
      relativeLabel: 'In 15 Tagen',
    },
    {
      id: 'e2',
      title: 'sfs',
      startsAt: '2026-05-27T10:00:00.000Z',
      endsAt: '2026-05-27T23:59:00.000Z',
      imageUrl: null,
      statusRank: 'far',
      isLive: false,
      startsSoon: false,
      dateLabel: 'Mi., 27. Mai',
      timeLabel: '10:00 – 23:59',
      relativeLabel: 'In 12 Tagen',
    },
  ],
  generatedAt: FIXED_NOW.toISOString(),
};

export const mediaImageFixture: MediaImageData = {
  mediaId: 'img-1',
  url: 'https://example.test/media/hero.jpg',
  altText: 'Wellness-Ambiente',
  fit: 'cover',
  title: 'Willkommen',
  showTitle: true,
};

export const mediaVideoFixture: MediaVideoData = {
  mediaId: 'vid-1',
  url: 'https://example.test/media/hero.mp4',
  fit: 'cover',
  playback: 'loop-duration',
  mutedByDefault: true,
  title: undefined,
  showTitle: false,
};

// ─── Lookup table ────────────────────────────────────────────────────────────

export const SLIDE_FIXTURES = {
  'sauna-detail': saunaDetailFixture,
  'content-panel': schedulePanelFixture,
  infos: infoPanelFixture,
  events: eventsPanelFixture,
  'media-image': mediaImageFixture,
  'media-video': mediaVideoFixture,
} as const;
