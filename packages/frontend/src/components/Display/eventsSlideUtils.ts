import type { Media } from '@/types/media.types';
import type { Settings } from '@/types/settings.types';
import type { DisplayViewportProfile } from './useDisplayViewportProfile';
import { getMediaUploadUrl } from '@/utils/mediaUrl';
import { formatEventDateDE, formatEventTimeRangeDE } from './wellnessDisplayUtils';

export type EventPresentation = {
  id: string;
  name: string;
  description?: string;
  imageUrl: string | null;
  dateLabel: string;
  timeLabel: string;
  badgeLabel: string;
  badgeBackground: string;
  badgeTextColor: string;
  isLive: boolean;
  startsSoon: boolean;
};

export interface EventPresentationColors {
  accentGold: string;
  accentGreen: string;
  statusLive: string;
  statusSoon: string;
  statusNext: string;
}

export interface EventsSlideLayout {
  isCompact: boolean;
  isVertical: boolean;
  maxEvents: number;
  showLeadDescriptionSpace: boolean;
  showSecondaryImages: boolean;
  showSecondaryDescriptions: boolean;
  secondaryImagePlacement: 'top' | 'side';
}

export function formatRelativeEventBadgeLabel(start: Date, end: Date, now: Date): string {
  if (now >= start && now <= end) {
    return 'Jetzt live';
  }

  const diffMinutes = Math.max(1, Math.round((start.getTime() - now.getTime()) / 60000));
  if (diffMinutes < 60) {
    return `In ${diffMinutes} Min.`;
  }

  const diffHours = Math.max(1, Math.round(diffMinutes / 60));
  if (diffHours < 48) {
    return `In ${diffHours} Std.`;
  }

  const diffDays = Math.max(1, Math.ceil(diffHours / 24));
  return diffDays === 1 ? 'In 1 Tag' : `In ${diffDays} Tagen`;
}

export function buildEventPresentationData(
  settings: Settings,
  media: Media[] | undefined,
  now: Date,
  colors: EventPresentationColors,
): EventPresentation[] {
  return (settings.events || [])
    .filter((event) => event.isActive)
    .map((event) => {
      const start = new Date(`${event.startDate}T${event.startTime}`);
      const endDate = event.endDate || event.startDate;
      const endTime = event.endTime || '23:59';
      const end = new Date(`${endDate}T${endTime}`);

      return { event, start, end };
    })
    .filter(({ start, end }) => Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()))
    .filter(({ start, end }) => now <= end || now <= start)
    .sort((left, right) => {
      const leftIsLive = now >= left.start && now <= left.end;
      const rightIsLive = now >= right.start && now <= right.end;

      if (leftIsLive !== rightIsLive) {
        return leftIsLive ? -1 : 1;
      }

      return left.start.getTime() - right.start.getTime();
    })
    .map(({ event, start, end }) => {
      const isLive = now >= start && now <= end;
      const diffMinutes = Math.round((start.getTime() - now.getTime()) / 60000);
      const startsSoon = !isLive && diffMinutes >= 0 && diffMinutes <= 180;

      const badgeBackground = isLive
        ? colors.statusLive
        : startsSoon
          ? colors.statusSoon
          : diffMinutes <= 1440
            ? colors.accentGreen
            : colors.statusNext;

      return {
        id: event.id,
        name: event.name,
        description: event.description?.trim() || undefined,
        imageUrl: event.imageId ? getMediaUploadUrl(media, event.imageId) : null,
        dateLabel: formatEventDateDE(event),
        timeLabel: formatEventTimeRangeDE(event),
        badgeLabel: formatRelativeEventBadgeLabel(start, end, now),
        badgeBackground,
        badgeTextColor: '#FFFDF8',
        isLive,
        startsSoon,
      };
    });
}

export function buildEventsSlideLayout(profile: DisplayViewportProfile): EventsSlideLayout {
  const isCompact = profile.height > 0 && (profile.isUltraCompact || profile.height < 250);
  const isVertical = profile.isPortrait || (profile.height > profile.width * 0.88);
  const maxEvents = isCompact
    ? 2
    : isVertical
      ? (profile.height >= 920 ? 5 : 4)
      : (profile.width >= 1240 && profile.height >= 620 ? 5 : 4);

  return {
    isCompact,
    isVertical,
    maxEvents,
    showLeadDescriptionSpace: profile.height >= (isVertical ? 420 : 320),
    showSecondaryImages: profile.height >= (isVertical ? 420 : 330) && profile.width >= (isVertical ? 390 : 700),
    showSecondaryDescriptions: profile.height >= (isVertical ? 340 : 300),
    secondaryImagePlacement: !isVertical && profile.width >= 920 ? 'side' : 'top',
  };
}
