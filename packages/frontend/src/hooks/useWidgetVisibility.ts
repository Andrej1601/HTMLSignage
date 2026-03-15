import { useEffect, useMemo, useState } from 'react';

export type DashboardWidgetKey =
  | 'operationsContent'
  | 'activityFeed'
  | 'systemChecks'
  | 'mediaInsights';

export type WidgetVisibilityState = Record<DashboardWidgetKey, boolean>;

export interface WidgetPreferenceItem {
  key: DashboardWidgetKey;
  title: string;
  description: string;
}

export const DEFAULT_WIDGET_VISIBILITY: WidgetVisibilityState = {
  operationsContent: true,
  activityFeed: true,
  systemChecks: true,
  mediaInsights: true,
};

export const WIDGET_PREFERENCES: WidgetPreferenceItem[] = [
  { key: 'operationsContent', title: 'Betrieb & Inhalte', description: 'Gerätezustand, Ausspielungsmodi, Live-Preset und Plan-Checks' },
  { key: 'activityFeed', title: 'Letzte Aktivitäten', description: 'Chronologischer Verlauf von Uploads und Änderungen' },
  { key: 'systemChecks', title: 'System-Checks', description: 'Backend, Datenbasis, WebSocket und Update-Status' },
  { key: 'mediaInsights', title: 'Medien-Insights', description: 'Dateitypen, Gesamtgröße und letzter Upload' },
];

function parseWidgetVisibility(raw: string | null): WidgetVisibilityState {
  if (!raw) return DEFAULT_WIDGET_VISIBILITY;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Migration: map old liveOperations/contentQuality to operationsContent
    let operationsContent: boolean;
    if ('operationsContent' in parsed) {
      operationsContent = parsed.operationsContent !== false;
    } else if ('liveOperations' in parsed || 'contentQuality' in parsed) {
      operationsContent = parsed.liveOperations !== false || parsed.contentQuality !== false;
    } else {
      operationsContent = true;
    }

    return {
      operationsContent,
      activityFeed: parsed.activityFeed !== false,
      systemChecks: parsed.systemChecks !== false,
      mediaInsights: parsed.mediaInsights !== false,
    };
  } catch {
    return DEFAULT_WIDGET_VISIBILITY;
  }
}

/**
 * Manages dashboard widget visibility with localStorage persistence.
 * @param storageKey - Per-user localStorage key (include user ID for isolation).
 */
export function useWidgetVisibility(storageKey: string) {
  const [widgetVisibility, setWidgetVisibility] = useState<WidgetVisibilityState>(DEFAULT_WIDGET_VISIBILITY);
  const [isWidgetPanelOpen, setIsWidgetPanelOpen] = useState(false);

  // Load from localStorage on mount / key change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(storageKey);
    setWidgetVisibility(parseWidgetVisibility(stored));
  }, [storageKey]);

  // Persist to localStorage whenever visibility changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(widgetVisibility));
  }, [storageKey, widgetVisibility]);

  const activeWidgetCount = useMemo(
    () => Object.values(widgetVisibility).filter(Boolean).length,
    [widgetVisibility],
  );

  const toggleWidget = (key: DashboardWidgetKey) =>
    setWidgetVisibility((prev) => ({ ...prev, [key]: !prev[key] }));

  const showAllWidgets = () => setWidgetVisibility({ ...DEFAULT_WIDGET_VISIBILITY });

  const setOpsFocus = () =>
    setWidgetVisibility({
      operationsContent: true,
      activityFeed: true,
      systemChecks: true,
      mediaInsights: false,
    });

  return {
    widgetVisibility,
    isWidgetPanelOpen,
    setIsWidgetPanelOpen,
    activeWidgetCount,
    toggleWidget,
    showAllWidgets,
    setOpsFocus,
  };
}
