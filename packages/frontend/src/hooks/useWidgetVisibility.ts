import { useEffect, useMemo, useState } from 'react';

export type DashboardWidgetKey =
  | 'liveOperations'
  | 'contentQuality'
  | 'activityFeed'
  | 'systemChecks'
  | 'mediaInsights'
  | 'quickActions';

export type WidgetVisibilityState = Record<DashboardWidgetKey, boolean>;

export interface WidgetPreferenceItem {
  key: DashboardWidgetKey;
  title: string;
  description: string;
}

export const DEFAULT_WIDGET_VISIBILITY: WidgetVisibilityState = {
  liveOperations: true,
  contentQuality: true,
  activityFeed: true,
  systemChecks: true,
  mediaInsights: true,
  quickActions: true,
};

export const WIDGET_PREFERENCES: WidgetPreferenceItem[] = [
  { key: 'liveOperations', title: 'Live-Betrieb', description: 'Online/Offline-Status und Ausspielungsmodi der Displays' },
  { key: 'contentQuality', title: 'Inhalte & Planqualität', description: 'Live-Preset, Event-Status und Plan-Checks' },
  { key: 'activityFeed', title: 'Letzte Aktivitäten', description: 'Chronologischer Verlauf von Uploads und Änderungen' },
  { key: 'systemChecks', title: 'System-Checks', description: 'Backend, Datenbasis, WebSocket und Update-Status' },
  { key: 'mediaInsights', title: 'Medien-Insights', description: 'Dateitypen, Gesamtgröße und letzter Upload' },
  { key: 'quickActions', title: 'Schnellzugriff', description: 'Direkte Navigation in die wichtigsten Arbeitsbereiche' },
];

function parseWidgetVisibility(raw: string | null): WidgetVisibilityState {
  if (!raw) return DEFAULT_WIDGET_VISIBILITY;
  try {
    const parsed = JSON.parse(raw) as Partial<WidgetVisibilityState>;
    return {
      liveOperations: parsed.liveOperations !== false,
      contentQuality: parsed.contentQuality !== false,
      activityFeed: parsed.activityFeed !== false,
      systemChecks: parsed.systemChecks !== false,
      mediaInsights: parsed.mediaInsights !== false,
      quickActions: parsed.quickActions !== false,
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
      liveOperations: true,
      contentQuality: false,
      activityFeed: true,
      systemChecks: true,
      mediaInsights: false,
      quickActions: true,
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
