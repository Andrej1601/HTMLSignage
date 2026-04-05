import { timeToMinutes } from './displayScheduleUtils';

const BASE_ROW_HEIGHT_PX = 72;
const MIN_ROW_HEIGHT_PX = 56;

export interface TimelineInfusion {
  id: string;
  time: string;
  duration: number;
  title: string;
  intensity: number;
}

export interface TimelineSegment {
  minute: number;
  top: number;
  height: number;
  striped: boolean;
}

export interface TimelineGeometry {
  startMinute: number;
  endMinute: number;
  stepMinute: number;
  rowHeight: number;
  pixelsPerMinute: number;
  contentHeight: number;
  slotMinutes: number[];
  segments: TimelineSegment[];
  minuteToY: (minute: number) => number;
}

export interface TimelineInfusionLayout {
  top: number;
  height: number;
}

export function minutesToTimeLabel(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function buildTimelineBranding(logoText: string): {
  firstWord: string;
  restWords: string;
} {
  const rawLogoText = logoText.trim();
  const normalizedLogoText = (!rawLogoText || /^html\s*signage$/i.test(rawLogoText))
    ? 'Westfalenbad Hagen'
    : rawLogoText;
  const titleWords = normalizedLogoText.split(' ');

  return {
    firstWord: titleWords[0] || 'Westfalenbad',
    restWords: titleWords.slice(1).join(' ') || 'Hagen',
  };
}

export function buildTimelineGeometry(
  rowTimes: string[],
  infusions: TimelineInfusion[],
  viewportHeight: number,
): TimelineGeometry | null {
  const rowMinutes = rowTimes
    .map((time) => timeToMinutes(time))
    .filter((minute) => Number.isFinite(minute))
    .sort((left, right) => left - right);
  const uniqueRowMinutes = Array.from(new Set(rowMinutes));

  const infusionStartMinutes = infusions
    .map((item) => timeToMinutes(item.time))
    .filter((minute) => Number.isFinite(minute));
  const infusionEndMinutes = infusions
    .map((item) => timeToMinutes(item.time) + Math.max(1, item.duration || 15))
    .filter((minute) => Number.isFinite(minute));

  const minMinute = Math.min(
    uniqueRowMinutes[0] ?? Number.POSITIVE_INFINITY,
    infusionStartMinutes[0] ?? Number.POSITIVE_INFINITY,
  );
  if (!Number.isFinite(minMinute)) return null;

  const positiveDiffs: number[] = [];
  for (let index = 1; index < uniqueRowMinutes.length; index += 1) {
    const diff = uniqueRowMinutes[index] - uniqueRowMinutes[index - 1];
    if (diff > 0) positiveDiffs.push(diff);
  }
  const stepMinute = positiveDiffs.length > 0 ? Math.min(...positiveDiffs) : 30;

  const maxFromRows = (uniqueRowMinutes[uniqueRowMinutes.length - 1] ?? minMinute) + stepMinute;
  const maxFromInfusions = infusionEndMinutes.length > 0
    ? Math.max(...infusionEndMinutes)
    : maxFromRows;
  const endMinute = Math.max(maxFromRows, maxFromInfusions);

  const slotMinutes: number[] = [];
  for (let cursor = minMinute; cursor <= endMinute; cursor += stepMinute) {
    slotMinutes.push(cursor);
  }
  if (slotMinutes.length < 2) {
    slotMinutes.push(minMinute + stepMinute);
  }

  const intervalCount = Math.max(1, slotMinutes.length - 1);
  const fittingRowHeight = viewportHeight > 0
    ? ((viewportHeight - 2) / intervalCount)
    : BASE_ROW_HEIGHT_PX;
  const rowHeight = Math.max(MIN_ROW_HEIGHT_PX, fittingRowHeight || BASE_ROW_HEIGHT_PX);

  const pixelsPerMinute = rowHeight / stepMinute;
  const minuteToY = (minute: number) => (minute - minMinute) * pixelsPerMinute;
  const contentHeight = intervalCount * rowHeight + 4;

  const segments = slotMinutes.slice(0, -1).map((minute, index) => {
    const nextMinute = slotMinutes[index + 1] ?? (minute + stepMinute);
    return {
      minute,
      top: minuteToY(minute),
      height: Math.max(1, minuteToY(nextMinute) - minuteToY(minute)),
      striped: index % 2 === 0,
    };
  });

  return {
    startMinute: minMinute,
    endMinute,
    stepMinute,
    rowHeight,
    pixelsPerMinute,
    contentHeight,
    slotMinutes,
    segments,
    minuteToY,
  };
}

export function buildTimelineInfusionLayout(
  infusion: TimelineInfusion,
  timeline: TimelineGeometry,
): TimelineInfusionLayout {
  const startMinute = timeToMinutes(infusion.time);
  const proportionalHeight = Math.max(44, infusion.duration * timeline.pixelsPerMinute - 8);
  const singleRowHeight = Math.max(48, timeline.rowHeight - 4);
  const minSameRowHeight = Math.max(56, timeline.rowHeight * 0.78);
  const minMultiRowHeight = Math.max(68, timeline.rowHeight * 0.9);
  const wantsSingleRow = infusion.duration <= timeline.stepMinute;
  const desiredHeight = wantsSingleRow
    ? Math.min(singleRowHeight, Math.max(minSameRowHeight, proportionalHeight))
    : Math.max(minMultiRowHeight, proportionalHeight);

  const topBase = timeline.minuteToY(startMinute);
  const top = wantsSingleRow
    ? topBase + Math.max(2, (timeline.rowHeight - desiredHeight) / 2)
    : topBase + 4;
  const maxHeight = Math.max(44, timeline.contentHeight - top - 2);

  return {
    top,
    height: Math.min(desiredHeight, maxHeight),
  };
}
