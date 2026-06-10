import { useMemo } from 'react';
import type {
  EventSlideEntry,
  EventStatusRank,
  EventsPanelData,
} from '@htmlsignage/design-sdk';
import type { Settings } from '@/types/settings.types';
import type { Media } from '@/types/media.types';
import { getMediaUploadUrl } from '@/utils/mediaUrl';
import {
  formatEventDateDE,
  formatEventTimeRangeDE,
} from '@/components/Display/wellnessDisplayUtils';
import { formatRelativeEventBadgeLabel } from '@/components/Display/eventsSlideUtils';

export interface UseEventsPanelDataInput {
  settings: Settings;
  media?: Media[];
  now: Date;
  /** Soon window in minutes (default 180). */
  soonWindowMin?: number;
  /** "Near" window in minutes — inside this, status is 'near' instead of 'far' (default 1440). */
  nearWindowMin?: number;
}

function statusRank(
  now: Date,
  start: Date,
  end: Date,
  soonWindowMin: number,
  nearWindowMin: number,
): { rank: EventStatusRank; isLive: boolean; startsSoon: boolean } {
  const isLive = now >= start && now <= end;
  if (isLive) return { rank: 'live', isLive: true, startsSoon: false };

  const diffMin = Math.round((start.getTime() - now.getTime()) / 60000);
  const startsSoon = diffMin >= 0 && diffMin <= soonWindowMin;
  if (startsSoon) return { rank: 'soon', isLive: false, startsSoon: true };
  if (diffMin >= 0 && diffMin <= nearWindowMin) {
    return { rank: 'near', isLive: false, startsSoon: false };
  }
  return { rank: 'far', isLive: false, startsSoon: false };
}

/**
 * Headless data hook for the events slide.
 *
 * Produces a sorted list of active + upcoming events with pre-computed
 * status flags and pre-formatted localized labels. Renderers consume
 * `statusRank` to drive styling — no visual colors leak into the data.
 */
export function useEventsPanelData(input: UseEventsPanelDataInput): EventsPanelData {
  const {
    settings,
    media,
    now,
    soonWindowMin = 180,
    nearWindowMin = 1440,
  } = input;

  return useMemo<EventsPanelData>(() => {
    const rows = (settings.events ?? [])
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
      .sort((a, b) => {
        const aLive = now >= a.start && now <= a.end;
        const bLive = now >= b.start && now <= b.end;
        if (aLive !== bLive) return aLive ? -1 : 1;
        return a.start.getTime() - b.start.getTime();
      });

    const events: EventSlideEntry[] = rows.map(({ event, start, end }) => {
      const { rank, isLive, startsSoon } = statusRank(now, start, end, soonWindowMin, nearWindowMin);
      return {
        id: event.id,
        title: event.name,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        location: undefined,
        description: event.description?.trim() || undefined,
        imageUrl: event.imageId ? (getMediaUploadUrl(media, event.imageId) ?? null) : null,
        statusRank: rank,
        isLive,
        startsSoon,
        dateLabel: formatEventDateDE(event),
        timeLabel: formatEventTimeRangeDE(event),
        relativeLabel: formatRelativeEventBadgeLabel(start, end, now),
      };
    });

    return {
      events,
      generatedAt: now.toISOString(),
    };
  }, [settings.events, media, now, soonWindowMin, nearWindowMin]);
}
