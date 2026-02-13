import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Edit2,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { SlideEditor } from '@/components/Slideshow/SlideEditor';
import { SlidePreview } from '@/components/Slideshow/SlidePreview';
import { useSettings } from '@/hooks/useSettings';
import { useClearOverrides, useSetOverrides } from '@/hooks/useDevices';
import type { Device } from '@/types/device.types';
import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import type { LayoutType, SlideConfig, SlideType, SlideshowConfig } from '@/types/slideshow.types';
import {
  LAYOUT_OPTIONS,
  createDefaultSlideshowConfig,
  createEmptySlide,
  getSlidesByZone,
  getZonesForLayout,
  reorderSlides,
  SLIDE_TYPE_OPTIONS,
} from '@/types/slideshow.types';

interface DeviceOverridesDialogProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneConfig(config: SlideshowConfig): SlideshowConfig {
  return JSON.parse(JSON.stringify(config)) as SlideshowConfig;
}

function isScheduleOverride(value: unknown): value is Schedule {
  if (!isPlainRecord(value)) return false;
  return (
    typeof value.version === 'number' &&
    isPlainRecord(value.presets) &&
    typeof value.autoPlay === 'boolean'
  );
}

function getOverrideSettings(device: Device | null): Record<string, unknown> {
  const settings = device?.overrides?.settings;
  return isPlainRecord(settings) ? { ...settings } : {};
}

function getOverrideSlideshowConfig(device: Device | null): SlideshowConfig | null {
  const settings = getOverrideSettings(device);
  const raw = settings.slideshow;
  if (!isPlainRecord(raw) || !Array.isArray(raw.slides)) return null;

  const defaults = createDefaultSlideshowConfig();
  const merged = {
    ...defaults,
    ...raw,
    slides: raw.slides as SlideConfig[],
  } as SlideshowConfig;

  return merged;
}

function getSlideTypeLabel(type: SlideType): string {
  return SLIDE_TYPE_OPTIONS.find((opt) => opt.type === type)?.label || type;
}

function normalizeLayout(layout: unknown): LayoutType {
  return LAYOUT_OPTIONS.some((opt) => opt.type === layout)
    ? (layout as LayoutType)
    : 'split-view';
}

function normalizeSlideshowConfig(config: SlideshowConfig): SlideshowConfig {
  const defaults = createDefaultSlideshowConfig();
  const layout = normalizeLayout(config.layout);
  const zones = getZonesForLayout(layout);
  const allowedZoneIds = new Set(zones.map((zone) => zone.id));
  const fallbackZoneId = zones[0]?.id || 'main';
  const validSlideTypes = new Set(SLIDE_TYPE_OPTIONS.map((option) => option.type));
  const validTransitions = new Set(['fade', 'slide', 'zoom', 'none']);
  const baseDuration = typeof config.defaultDuration === 'number' && Number.isFinite(config.defaultDuration)
    ? Math.max(1, Math.round(config.defaultDuration))
    : defaults.defaultDuration;

  const groupedSlides = new Map<string, SlideConfig[]>();
  for (const zone of zones) {
    groupedSlides.set(zone.id, []);
  }

  for (const rawSlide of config.slides || []) {
    if (!isPlainRecord(rawSlide)) continue;

    const rawZoneId = typeof rawSlide.zoneId === 'string' ? rawSlide.zoneId : fallbackZoneId;
    const zoneId = allowedZoneIds.has(rawZoneId) ? rawZoneId : fallbackZoneId;
    const rawType = typeof rawSlide.type === 'string' ? rawSlide.type : 'content-panel';
    const type: SlideType = validSlideTypes.has(rawType as SlideType)
      ? (rawType as SlideType)
      : 'content-panel';
    const transition = typeof rawSlide.transition === 'string' && validTransitions.has(rawSlide.transition)
      ? rawSlide.transition as SlideConfig['transition']
      : 'fade';

    const normalizedSlide: SlideConfig = {
      ...(rawSlide as SlideConfig),
      id: typeof rawSlide.id === 'string' && rawSlide.id ? rawSlide.id : generateId(),
      type,
      enabled: rawSlide.enabled !== false,
      duration: typeof rawSlide.duration === 'number' && Number.isFinite(rawSlide.duration)
        ? Math.max(1, Math.round(rawSlide.duration))
        : baseDuration,
      order: 0,
      zoneId,
      transition,
    };

    groupedSlides.get(zoneId)?.push(normalizedSlide);
  }

  const normalizedSlides: SlideConfig[] = [];
  for (const zone of zones) {
    const zoneSlides = groupedSlides.get(zone.id) || [];
    const orderedSlides = zoneSlides
      .sort((a, b) => a.order - b.order)
      .map((slide, order) => ({
        ...slide,
        zoneId: zone.id,
        order,
      }));
    normalizedSlides.push(...orderedSlides);
  }

  return {
    ...defaults,
    ...config,
    layout,
    defaultDuration: baseDuration,
    slides: normalizedSlides,
  };
}

function replaceZoneSlides(config: SlideshowConfig, zoneId: string, zoneSlides: SlideConfig[]): SlideshowConfig {
  const otherSlides = config.slides.filter((slide) => (slide.zoneId || 'main') !== zoneId);
  const normalizedZoneSlides = zoneSlides.map((slide, index) => ({
    ...slide,
    zoneId,
    order: index,
  }));
  return {
    ...config,
    slides: [...otherSlides, ...normalizedZoneSlides],
  };
}

export function DeviceOverridesDialog({ device, isOpen, onClose }: DeviceOverridesDialogProps) {
  const { settings: globalSettings } = useSettings();
  const setOverrides = useSetOverrides();
  const clearOverrides = useClearOverrides();

  const [localConfig, setLocalConfig] = useState<SlideshowConfig | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [editingSlide, setEditingSlide] = useState<SlideConfig | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string>('main');

  const isBusy = setOverrides.isPending || clearOverrides.isPending;

  const hasSlideshowOverride = useMemo(() => {
    const settings = getOverrideSettings(device);
    return isPlainRecord(settings.slideshow);
  }, [device]);

  useEffect(() => {
    if (!isOpen || !device) return;

    const overrideConfig = getOverrideSlideshowConfig(device);
    const fallbackConfig = globalSettings?.slideshow || createDefaultSlideshowConfig();
    const initialConfig = normalizeSlideshowConfig(cloneConfig(overrideConfig || fallbackConfig));

    setLocalConfig(initialConfig);
    setSelectedZone(getZonesForLayout(initialConfig.layout)[0]?.id || 'main');
    setEditingSlide(null);
    setIsAddingNew(false);
    setIsDirty(false);
  }, [device, globalSettings?.slideshow, isOpen]);

  if (!isOpen || !device) return null;

  const zones = localConfig ? getZonesForLayout(localConfig.layout) : [];

  const handleClose = () => {
    if (isBusy) return;
    onClose();
  };

  const handleLayoutChange = (layout: LayoutType) => {
    if (!localConfig) return;

    const updated = normalizeSlideshowConfig({
      ...localConfig,
      layout,
    });
    setLocalConfig(updated);
    setSelectedZone(getZonesForLayout(layout)[0]?.id || 'main');
    setIsDirty(true);
  };

  const handleAddSlide = (zoneId: string) => {
    setSelectedZone(zoneId);
    setIsAddingNew(true);
  };

  const handleSaveNewSlide = (slideData: Omit<SlideConfig, 'id'> | SlideConfig) => {
    if (!localConfig) return;
    if ('id' in slideData) return;

    const zoneId = selectedZone || getZonesForLayout(localConfig.layout)[0]?.id || 'main';
    const zoneSlides = getSlidesByZone(localConfig.slides, zoneId);

    const newSlide: SlideConfig = {
      ...slideData,
      id: generateId(),
      zoneId,
      order: zoneSlides.length,
      duration: Math.max(1, Math.round(slideData.duration || localConfig.defaultDuration || 10)),
      transition: slideData.transition || localConfig.defaultTransition,
    };

    const updated = normalizeSlideshowConfig({
      ...localConfig,
      slides: [...localConfig.slides, newSlide],
    });

    setLocalConfig(updated);
    setIsAddingNew(false);
    setIsDirty(true);
  };

  const handleSaveEditedSlide = (slideData: Omit<SlideConfig, 'id'> | SlideConfig) => {
    if (!localConfig) return;
    if (!('id' in slideData)) return;

    const updated = normalizeSlideshowConfig({
      ...localConfig,
      slides: localConfig.slides.map((slide) => (
        slide.id === slideData.id ? slideData : slide
      )),
    });

    setLocalConfig(updated);
    setEditingSlide(null);
    setIsDirty(true);
  };

  const handleDeleteSlide = (slideId: string, zoneId: string) => {
    if (!localConfig) return;
    if (!window.confirm('Slide wirklich entfernen?')) return;

    const zoneSlides = getSlidesByZone(localConfig.slides, zoneId).filter((slide) => slide.id !== slideId);
    const updated = normalizeSlideshowConfig(replaceZoneSlides(localConfig, zoneId, zoneSlides));
    setLocalConfig(updated);
    setIsDirty(true);
  };

  const handleMoveSlide = (zoneId: string, fromIndex: number, direction: -1 | 1) => {
    if (!localConfig) return;

    const zoneSlides = getSlidesByZone(localConfig.slides, zoneId);
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= zoneSlides.length) return;

    const reordered = reorderSlides(zoneSlides, fromIndex, toIndex).map((slide, index) => ({
      ...slide,
      zoneId,
      order: index,
    }));

    const updated = normalizeSlideshowConfig(replaceZoneSlides(localConfig, zoneId, reordered));
    setLocalConfig(updated);
    setIsDirty(true);
  };

  const handleToggleSlide = (slideId: string) => {
    if (!localConfig) return;

    const updated = normalizeSlideshowConfig({
      ...localConfig,
      slides: localConfig.slides.map((slide) => (
        slide.id === slideId ? { ...slide, enabled: !slide.enabled } : slide
      )),
    });
    setLocalConfig(updated);
    setIsDirty(true);
  };

  const handleSaveOverrides = () => {
    if (!device || !localConfig) return;

    const currentSettingsOverride = getOverrideSettings(device);
    const nextSettings: Partial<Settings> = {
      ...(currentSettingsOverride as Partial<Settings>),
      slideshow: {
        ...localConfig,
        version: (localConfig.version || 1) + 1,
      },
    };

    setOverrides.mutate(
      {
        id: device.id,
        overrides: { settings: nextSettings },
      },
      {
        onSuccess: () => {
          setIsDirty(false);
          onClose();
        },
      }
    );
  };

  const handleRemoveSlideshowOverride = () => {
    if (!device) return;

    const currentSettingsOverride = getOverrideSettings(device);
    delete currentSettingsOverride.slideshow;

    const hasRemainingSettingsOverride = Object.keys(currentSettingsOverride).length > 0;
    const existingSchedule = device.overrides?.schedule;
    const scheduleOverride = isScheduleOverride(existingSchedule) ? existingSchedule : undefined;

    if (hasRemainingSettingsOverride || scheduleOverride) {
      const nextSettingsOverride = hasRemainingSettingsOverride
        ? currentSettingsOverride as Partial<Settings>
        : {};

      setOverrides.mutate(
        {
          id: device.id,
          overrides: {
            settings: nextSettingsOverride,
            schedule: scheduleOverride,
          },
        },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
      return;
    }

    clearOverrides.mutate(device.id, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 p-4">
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
          <div className="flex items-start justify-between border-b border-spa-bg-secondary p-6">
            <div>
              <h2 className="text-2xl font-bold text-spa-text-primary">Slideshow Override verwalten</h2>
              <p className="mt-1 text-sm text-spa-text-secondary">
                Geraet: {device.name} ({device.id})
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isBusy}
              className="rounded-lg p-2 text-spa-text-secondary transition-colors hover:bg-spa-bg-primary disabled:opacity-50"
              aria-label="Schliessen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6 rounded-lg border border-spa-bg-secondary bg-spa-bg-primary/40 p-4">
              <p className="text-sm text-spa-text-primary">
                {hasSlideshowOverride
                  ? 'Dieses Geraet nutzt bereits eine eigene Slideshow-Konfiguration.'
                  : 'Noch kein eigenes Slideshow-Override. Beim Speichern wird ein Override fuer dieses Geraet erstellt.'}
              </p>
            </div>

            {!localConfig && (
              <div className="rounded-lg border border-spa-bg-secondary bg-white p-6 text-spa-text-secondary">
                Lade Slideshow-Konfiguration...
              </div>
            )}

            {localConfig && (
              <div className="space-y-6">
                <div className="rounded-lg border border-spa-bg-secondary bg-white p-6">
                  <h3 className="mb-4 text-lg font-semibold text-spa-text-primary">Layout</h3>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {LAYOUT_OPTIONS.map((layoutOption) => (
                      <button
                        key={layoutOption.type}
                        onClick={() => handleLayoutChange(layoutOption.type)}
                        disabled={isBusy}
                        className={`rounded-lg border-2 p-3 text-left transition-all ${
                          localConfig.layout === layoutOption.type
                            ? 'border-spa-primary bg-spa-primary/5'
                            : 'border-spa-bg-secondary hover:border-spa-primary/50'
                        }`}
                      >
                        <div className="mb-2 text-2xl">{layoutOption.icon}</div>
                        <div className="font-semibold text-spa-text-primary">{layoutOption.label}</div>
                        <div className="mt-1 text-xs text-spa-text-secondary">{layoutOption.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {zones.map((zone) => {
                  const zoneSlides = getSlidesByZone(localConfig.slides, zone.id);

                  return (
                    <div key={zone.id} className="rounded-lg border border-spa-bg-secondary bg-white">
                      <div className="flex items-center justify-between border-b border-spa-bg-secondary px-5 py-4">
                        <div>
                          <h4 className="text-base font-semibold text-spa-text-primary">{zone.name}</h4>
                          <p className="text-xs text-spa-text-secondary">
                            {zoneSlides.length} Slide{zoneSlides.length === 1 ? '' : 's'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAddSlide(zone.id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 rounded-md bg-spa-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-spa-primary-dark disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                          Slide
                        </button>
                      </div>

                      {zoneSlides.length === 0 && (
                        <div className="px-5 py-8 text-sm text-spa-text-secondary">
                          Keine Slides in dieser Zone.
                        </div>
                      )}

                      {zoneSlides.length > 0 && (
                        <div className="divide-y divide-spa-bg-secondary">
                          {zoneSlides.map((slide, index) => (
                            <div key={slide.id} className="flex items-center gap-4 px-5 py-4">
                              <SlidePreview slide={slide} />

                              <div className="min-w-0 flex-1">
                                <div className="mb-1 flex items-center gap-2">
                                  <span className="font-semibold text-spa-text-primary">
                                    {slide.title || getSlideTypeLabel(slide.type)}
                                  </span>
                                  <span className="rounded-full bg-spa-secondary/20 px-2 py-0.5 text-xs text-spa-secondary-dark">
                                    {slide.type}
                                  </span>
                                  {!slide.enabled && (
                                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                                      deaktiviert
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-spa-text-secondary">
                                  {getSlideTypeLabel(slide.type)} • {slide.duration}s
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleMoveSlide(zone.id, index, -1)}
                                  disabled={isBusy || index === 0}
                                  className="rounded-md p-2 text-spa-text-secondary transition-colors hover:bg-spa-bg-primary disabled:opacity-40"
                                  title="Nach oben"
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleMoveSlide(zone.id, index, 1)}
                                  disabled={isBusy || index === zoneSlides.length - 1}
                                  className="rounded-md p-2 text-spa-text-secondary transition-colors hover:bg-spa-bg-primary disabled:opacity-40"
                                  title="Nach unten"
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleSlide(slide.id)}
                                  disabled={isBusy}
                                  className="rounded-md p-2 text-spa-text-secondary transition-colors hover:bg-spa-bg-primary disabled:opacity-40"
                                  title={slide.enabled ? 'Deaktivieren' : 'Aktivieren'}
                                >
                                  {slide.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                </button>
                                <button
                                  onClick={() => setEditingSlide(slide)}
                                  disabled={isBusy}
                                  className="rounded-md p-2 text-spa-secondary transition-colors hover:bg-spa-secondary/10 disabled:opacity-40"
                                  title="Bearbeiten"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSlide(slide.id, zone.id)}
                                  disabled={isBusy}
                                  className="rounded-md p-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                                  title="Loeschen"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-spa-bg-secondary p-6">
            <button
              onClick={handleRemoveSlideshowOverride}
              disabled={isBusy || !hasSlideshowOverride}
              className="inline-flex items-center gap-2 rounded-md border border-spa-bg-secondary px-4 py-2 text-sm text-spa-text-primary transition-colors hover:bg-spa-bg-primary disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Slideshow Override entfernen
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                disabled={isBusy}
                className="rounded-md bg-spa-bg-secondary px-4 py-2 text-spa-text-primary transition-colors hover:bg-spa-secondary/20 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveOverrides}
                disabled={isBusy || !isDirty || !localConfig}
                className="inline-flex items-center gap-2 rounded-md bg-spa-primary px-4 py-2 font-medium text-white transition-colors hover:bg-spa-primary-dark disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {setOverrides.isPending ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <SlideEditor
        slide={isAddingNew ? createEmptySlide(0, selectedZone) : editingSlide}
        isOpen={isAddingNew || !!editingSlide}
        onClose={() => {
          setIsAddingNew(false);
          setEditingSlide(null);
        }}
        onSave={isAddingNew ? handleSaveNewSlide : handleSaveEditedSlide}
      />
    </>
  );
}
