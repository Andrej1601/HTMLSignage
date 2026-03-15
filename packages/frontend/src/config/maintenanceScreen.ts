import type { MaintenanceScreenSettings } from '@/types/settings.types';

export const DEFAULT_MAINTENANCE_SCREEN_SETTINGS: MaintenanceScreenSettings = {
  label: 'Wartungsmodus',
  headline: 'Display voruebergehend pausiert',
  message: 'Dieses Geraet ist aktuell fuer Wartung, Diagnose oder einen Rollout reserviert.',
  showDeviceName: true,
  backgroundImageId: undefined,
};

function normalizeText(value: string | undefined, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function normalizeMaintenanceScreenSettings(
  value?: MaintenanceScreenSettings | null,
): Required<Omit<MaintenanceScreenSettings, 'backgroundImageId'>> & { backgroundImageId?: string } {
  return {
    label: normalizeText(value?.label, DEFAULT_MAINTENANCE_SCREEN_SETTINGS.label || 'Wartungsmodus'),
    headline: normalizeText(
      value?.headline,
      DEFAULT_MAINTENANCE_SCREEN_SETTINGS.headline || 'Display voruebergehend pausiert',
    ),
    message: normalizeText(
      value?.message,
      DEFAULT_MAINTENANCE_SCREEN_SETTINGS.message || 'Dieses Geraet ist aktuell reserviert.',
    ),
    showDeviceName: value?.showDeviceName ?? true,
    backgroundImageId:
      typeof value?.backgroundImageId === 'string' && value.backgroundImageId.trim().length > 0
        ? value.backgroundImageId
        : undefined,
  };
}
