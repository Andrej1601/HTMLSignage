import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { DisplayLivePreview } from '@/components/Display/DisplayLivePreview';
import { DeviceOverridesDialog } from '@/components/Devices/DeviceOverridesDialog';
import { SlideEditor } from '@/components/Slideshow/SlideEditor';
import { SlidePreview } from '@/components/Slideshow/SlidePreview';
import { useDevices, useUpdateDevice } from '@/hooks/useDevices';
import { useSchedule } from '@/hooks/useSchedule';
import { useSettings } from '@/hooks/useSettings';
import { createDefaultSchedule } from '@/types/schedule.types';
import type { Device } from '@/types/device.types';
import { getDeviceStatus, getStatusColor, getStatusLabel, getModeLabel } from '@/types/device.types';
import type { SlideshowConfig, SlideConfig, LayoutType } from '@/types/slideshow.types';
import {
  createDefaultSlideshowConfig,
  createEmptySlide,
  LAYOUT_OPTIONS,
  reorderSlides,
  getEnabledSlides,
  getZonesForLayout,
  getSlidesByZone,
} from '@/types/slideshow.types';
import { migrateSettings } from '@/utils/slideshowMigration';
import {
  Save,
  RefreshCw,
  AlertCircle,
  Plus,
  GripVertical,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Play,
  Monitor,
  Settings,
} from 'lucide-react';
import clsx from 'clsx';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Simple UUID generator
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasDeviceSlideshowOverrides(device: Device): boolean {
  const scheduleOverride = device.overrides?.schedule;
  const settingsOverride = device.overrides?.settings;

  const hasScheduleOverride = isPlainRecord(scheduleOverride) && 'presets' in scheduleOverride;
  const hasSettingsOverride = isPlainRecord(settingsOverride) && Object.keys(settingsOverride).length > 0;

  return hasScheduleOverride || hasSettingsOverride;
}

function getDeviceSlideshowSource(device: Device): {
  label: string;
  detail: string;
  badgeClass: string;
  usesGlobal: boolean;
} {
  const hasOverrides = hasDeviceSlideshowOverrides(device);

  if (device.mode === 'override' && hasOverrides) {
    return {
      label: 'Override aktiv',
      detail: 'Dieses Display nutzt eine eigene Slideshow-/Settings-Konfiguration.',
      badgeClass: 'bg-blue-100 text-blue-700',
      usesGlobal: false,
    };
  }

  if (device.mode === 'override' && !hasOverrides) {
    return {
      label: 'Global (kein Override)',
      detail: 'Modus ist Ueberschrieben, aber es sind keine Overrides gespeichert.',
      badgeClass: 'bg-amber-100 text-amber-700',
      usesGlobal: true,
    };
  }

  if (device.mode === 'auto' && hasOverrides) {
    return {
      label: 'Global (Override hinterlegt)',
      detail: 'Override ist gespeichert, wird im Modus Automatisch aber nicht verwendet.',
      badgeClass: 'bg-emerald-100 text-emerald-700',
      usesGlobal: true,
    };
  }

  return {
    label: 'Global',
    detail: 'Dieses Display nutzt die globale Slideshow aus diesem Reiter.',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    usesGlobal: true,
  };
}

// Sortable Slide Item Component
interface SortableSlideItemProps {
  slide: SlideConfig;
  index: number;
  onToggleEnabled: (id: string) => void;
  onEdit: (slide: SlideConfig) => void;
  onDelete: (id: string) => void;
}

function SortableSlideItem({
  slide,
  index,
  onToggleEnabled,
  onEdit,
  onDelete,
}: SortableSlideItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'p-4 flex items-center gap-4 hover:bg-spa-bg-primary/50 transition-colors',
        !slide.enabled && 'opacity-50',
        isDragging && 'z-50 shadow-lg'
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-5 h-5 text-spa-text-secondary hover:text-spa-primary" />
      </div>

      {/* Preview */}
      <SlidePreview slide={slide} />

      {/* Order Badge */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-spa-primary text-white flex items-center justify-center font-bold text-sm">
        {index + 1}
      </div>

      {/* Slide Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-spa-text-primary">
            {slide.title || slide.type}
          </span>
          <span className="text-xs px-2 py-0.5 bg-spa-secondary/20 text-spa-secondary-dark rounded-full">
            {slide.type}
          </span>
        </div>
        <div className="text-sm text-spa-text-secondary">
          Dauer: {slide.duration}s
          {slide.transition && ` • Übergang: ${slide.transition}`}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggleEnabled(slide.id)}
          className={clsx(
            'p-2 rounded-md transition-colors',
            slide.enabled
              ? 'text-spa-primary hover:bg-spa-primary/10'
              : 'text-spa-text-secondary hover:bg-spa-bg-secondary'
          )}
          title={slide.enabled ? 'Deaktivieren' : 'Aktivieren'}
        >
          {slide.enabled ? (
            <Eye className="w-5 h-5" />
          ) : (
            <EyeOff className="w-5 h-5" />
          )}
        </button>

        <button
          onClick={() => onEdit(slide)}
          className="p-2 text-spa-secondary hover:bg-spa-secondary/10 rounded-md transition-colors"
          title="Bearbeiten"
        >
          <Edit className="w-5 h-5" />
        </button>

        <button
          onClick={() => onDelete(slide.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
          title="Löschen"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export function SlideshowPage() {
  const { settings, isLoading, error, save, isSaving, refetch } = useSettings();
  const { schedule } = useSchedule();
  const { data: devices = [] } = useDevices();
  const updateDevice = useUpdateDevice();

  const [localConfig, setLocalConfig] = useState<SlideshowConfig | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [editingSlide, setEditingSlide] = useState<SlideConfig | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string>('main');
  const [overrideDevice, setOverrideDevice] = useState<Device | null>(null);

  const previewSettings = useMemo(() => {
    if (!settings || !localConfig) return null;

    return migrateSettings({
      ...settings,
      slideshow: {
        ...localConfig,
        version: (localConfig.version || 1) + (isDirty ? 1 : 0),
      },
    });
  }, [settings, localConfig, isDirty]);

  const previewSchedule = schedule || createDefaultSchedule();
  const pairedDevices = useMemo(
    () => devices.filter((device) => Boolean(device.pairedAt)),
    [devices]
  );

  const deviceSourceSummary = useMemo(() => {
    const summary = {
      global: 0,
      overrideActive: 0,
      overrideStoredInactive: 0,
      overrideModeWithoutData: 0,
    };

    for (const device of pairedDevices) {
      const source = getDeviceSlideshowSource(device);
      if (!source.usesGlobal && source.label === 'Override aktiv') {
        summary.overrideActive += 1;
        continue;
      }
      if (source.label === 'Global (Override hinterlegt)') {
        summary.overrideStoredInactive += 1;
        continue;
      }
      if (source.label === 'Global (kein Override)') {
        summary.overrideModeWithoutData += 1;
        continue;
      }
      summary.global += 1;
    }

    return summary;
  }, [pairedDevices]);

  // Initialize from settings
  useEffect(() => {
    if (!isInitialized && settings) {
      if (settings.slideshow) {
        setLocalConfig(settings.slideshow);
      } else {
        // Create default config
        const defaultConfig = createDefaultSlideshowConfig();
        setLocalConfig(defaultConfig);
      }
      setIsInitialized(true);
    }
  }, [settings, isInitialized]);

  // Ensure all slides have a zoneId (migration for old data)
  useEffect(() => {
    if (!localConfig) return;

    const zones = getZonesForLayout(localConfig.layout);
    const slidesNeedingZone = localConfig.slides.filter((s) => !s.zoneId);

    if (slidesNeedingZone.length > 0) {
      const defaultZone = zones[0]?.id || 'main';
      const updatedSlides = localConfig.slides.map((slide) =>
        slide.zoneId ? slide : { ...slide, zoneId: defaultZone }
      );
      setLocalConfig({ ...localConfig, slides: updatedSlides });
      setIsDirty(true);
    }
  }, [localConfig?.layout, localConfig?.slides?.length]);

  const handleLayoutChange = (layout: LayoutType) => {
    if (!localConfig) return;
    setLocalConfig({ ...localConfig, layout });
    setIsDirty(true);
  };

  const handleAddSlide = (zoneId: string = 'main') => {
    setSelectedZone(zoneId);
    setIsAddingNew(true);
  };

  const handleSaveNewSlide = (slideData: Omit<SlideConfig, 'id'>) => {
    if (!localConfig) return;

    const zoneSlides = getSlidesByZone(localConfig.slides, selectedZone);
    const newSlide: SlideConfig = {
      ...slideData,
      id: generateId(),
      zoneId: selectedZone,
      order: zoneSlides.length,
    };

    setLocalConfig({
      ...localConfig,
      slides: [...localConfig.slides, newSlide],
    });
    setIsDirty(true);
    setIsAddingNew(false);
  };

  const handleEditSlide = (slide: SlideConfig) => {
    setEditingSlide(slide);
  };

  const handleSaveEditSlide = (slideData: SlideConfig) => {
    if (!localConfig) return;

    const updatedSlides = localConfig.slides.map((s) =>
      s.id === slideData.id ? slideData : s
    );

    setLocalConfig({
      ...localConfig,
      slides: updatedSlides,
    });
    setIsDirty(true);
    setEditingSlide(null);
  };

  const handleDeleteSlide = (id: string) => {
    if (!localConfig) return;
    if (!confirm('Möchtest du diesen Slide wirklich löschen?')) return;

    const updatedSlides = localConfig.slides
      .filter((s) => s.id !== id)
      .map((s, index) => ({ ...s, order: index }));

    setLocalConfig({
      ...localConfig,
      slides: updatedSlides,
    });
    setIsDirty(true);
  };

  const handleToggleEnabled = (id: string) => {
    if (!localConfig) return;

    const updatedSlides = localConfig.slides.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );

    setLocalConfig({
      ...localConfig,
      slides: updatedSlides,
    });
    setIsDirty(true);
  };

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (zoneId: string) => (event: DragEndEvent) => {
    const { active, over } = event;

    if (!localConfig || !over || active.id === over.id) return;

    // Get slides for this specific zone
    const zoneSlides = getSlidesByZone(localConfig.slides, zoneId);
    const oldIndex = zoneSlides.findIndex((s) => s.id === active.id);
    const newIndex = zoneSlides.findIndex((s) => s.id === over.id);

    // Reorder within the zone
    const reordered = reorderSlides(zoneSlides, oldIndex, newIndex);

    // Update all slides: replace zone slides with reordered ones
    const otherSlides = localConfig.slides.filter((s) => s.zoneId !== zoneId);
    const updatedSlides = [...otherSlides, ...reordered];

    setLocalConfig({
      ...localConfig,
      slides: updatedSlides,
    });
    setIsDirty(true);
  };

  const handleSaveAll = () => {
    if (!settings || !localConfig) return;

    const updatedSettings = {
      ...settings,
      slideshow: {
        ...localConfig,
        version: (localConfig.version || 1) + 1,
      },
      version: (settings.version || 1) + 1,
    };

    save(updatedSettings, {
      onSuccess: () => {
        setIsDirty(false);
      },
    });
  };

  const handleReload = () => {
    setIsInitialized(false);
    setIsDirty(false);
    refetch();
  };

  const handleDeviceModeChange = (device: Device, mode: 'auto' | 'override') => {
    if (device.mode === mode) return;
    updateDevice.mutate({
      id: device.id,
      updates: { mode },
    });
  };

  if (isLoading || !localConfig) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-spa-text-secondary">Lädt Slideshow-Konfiguration...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Fehler beim Laden</h3>
            <p className="text-red-700 text-sm mt-1">
              {error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const enabledSlides = getEnabledSlides(localConfig);
  const currentLayout = LAYOUT_OPTIONS.find((opt) => opt.type === localConfig.layout);
  const zones = getZonesForLayout(localConfig.layout);

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-spa-text-primary">Slideshow Konfiguration</h2>
            <p className="text-spa-text-secondary mt-1">
              {localConfig.slides.length} Slide{localConfig.slides.length !== 1 ? 's' : ''} ({enabledSlides.length} aktiv)
              {isDirty && (
                <span className="ml-2 text-orange-600 font-medium">• Ungespeicherte Änderungen</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReload}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-spa-text-secondary hover:bg-spa-bg-secondary rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Neu laden
            </button>

            <button
              onClick={handleSaveAll}
              disabled={!isDirty || isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </div>

        {previewSettings && (
          <div className="mb-6 bg-white rounded-lg shadow p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-spa-text-primary">1:1 Monitor-Vorschau</h3>
                <p className="text-xs text-spa-text-secondary mt-1">
                  Direkte Vorschau der echten `/display` Ansicht mit deiner aktuellen Konfiguration.
                </p>
              </div>
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                isDirty ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
              }`}>
                {isDirty ? 'Ungespeicherte Aenderungen aktiv' : 'Gespeicherter Stand'}
              </span>
            </div>

            <DisplayLivePreview
              schedule={previewSchedule}
              settings={previewSettings}
            />
          </div>
        )}

        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-spa-text-primary">Geräte-Ausspielung</h3>
              <p className="text-xs text-spa-text-secondary mt-1">
                Hier siehst du pro Display, ob gerade die globale Slideshow oder ein Override läuft.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                Global: {deviceSourceSummary.global}
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                Override aktiv: {deviceSourceSummary.overrideActive}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                Override hinterlegt: {deviceSourceSummary.overrideStoredInactive}
              </span>
              {deviceSourceSummary.overrideModeWithoutData > 0 && (
                <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">
                  Modus Override ohne Daten: {deviceSourceSummary.overrideModeWithoutData}
                </span>
              )}
            </div>
          </div>

          {pairedDevices.length === 0 ? (
            <div className="rounded-lg border border-spa-bg-secondary bg-spa-bg-primary/40 p-6 text-sm text-spa-text-secondary">
              Keine gekoppelten Displays vorhanden.
            </div>
          ) : (
            <div className="space-y-3">
              {pairedDevices.map((device) => {
                const source = getDeviceSlideshowSource(device);
                const status = getDeviceStatus(device.lastSeen);
                const statusColor = getStatusColor(status);

                return (
                  <div
                    key={device.id}
                    className="rounded-lg border border-spa-bg-secondary p-4"
                  >
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
                      <div className="lg:col-span-4">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-spa-primary" />
                          <p className="font-semibold text-spa-text-primary">{device.name}</p>
                        </div>
                        <p className="mt-1 font-mono text-xs text-spa-text-secondary">{device.id}</p>
                        <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${statusColor}`}>
                          <span className="h-2 w-2 rounded-full bg-current" />
                          {getStatusLabel(status)}
                        </span>
                      </div>

                      <div className="lg:col-span-2">
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">
                          Modus
                        </label>
                        <select
                          value={device.mode}
                          onChange={(event) => handleDeviceModeChange(device, event.target.value as 'auto' | 'override')}
                          disabled={updateDevice.isPending}
                          className="w-full rounded-md border border-spa-bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spa-primary disabled:opacity-60"
                        >
                          <option value="auto">{getModeLabel('auto')}</option>
                          <option value="override">{getModeLabel('override')}</option>
                        </select>
                      </div>

                      <div className="lg:col-span-4">
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">
                          Aktuelle Quelle
                        </label>
                        <div className="space-y-1">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${source.badgeClass}`}>
                            {source.label}
                          </span>
                          <p className="text-xs text-spa-text-secondary">{source.detail}</p>
                        </div>
                      </div>

                      <div className="flex justify-start lg:col-span-2 lg:justify-end">
                        <button
                          onClick={() => setOverrideDevice(device)}
                          className="inline-flex items-center gap-2 rounded-md bg-spa-secondary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-spa-secondary-dark"
                        >
                          <Settings className="h-4 w-4" />
                          Override
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Layout Selection */}
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-spa-text-primary mb-4">Display Layout</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {LAYOUT_OPTIONS.map((layout) => (
              <button
                key={layout.type}
                onClick={() => handleLayoutChange(layout.type)}
                className={clsx(
                  'p-4 rounded-lg border-2 transition-all text-left',
                  localConfig.layout === layout.type
                    ? 'border-spa-primary bg-spa-primary/5'
                    : 'border-spa-bg-secondary hover:border-spa-primary/50'
                )}
              >
                <div className="text-3xl mb-2">{layout.icon}</div>
                <div className="font-semibold text-spa-text-primary mb-1">{layout.label}</div>
                <div className="text-xs text-spa-text-secondary">{layout.description}</div>
              </button>
            ))}
          </div>

          {/* Layout-specific settings */}
          {currentLayout?.supportsPersistentZone && (
            <div className="mt-4 p-4 bg-spa-bg-primary rounded-lg">
              <h4 className="font-semibold text-spa-text-primary mb-3">Layout-Einstellungen</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-spa-text-primary mb-2">
                    Persistente Zone Position
                  </label>
                  <select
                    value={localConfig.persistentZonePosition || 'left'}
                    onChange={(e) => {
                      setLocalConfig({
                        ...localConfig,
                        persistentZonePosition: e.target.value as any,
                      });
                      setIsDirty(true);
                    }}
                    className="w-full px-3 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                  >
                    <option value="left">Links</option>
                    <option value="right">Rechts</option>
                    <option value="top">Oben</option>
                    <option value="bottom">Unten</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-spa-text-primary mb-2">
                    Zone Größe ({localConfig.persistentZoneSize || 50}%)
                  </label>
                  <input
                    type="range"
                    min="30"
                    max="70"
                    value={localConfig.persistentZoneSize || 50}
                    onChange={(e) => {
                      setLocalConfig({
                        ...localConfig,
                        persistentZoneSize: parseInt(e.target.value),
                      });
                      setIsDirty(true);
                    }}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Slides List - Zone-based Layout */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-spa-bg-secondary">
            <h3 className="text-lg font-semibold text-spa-text-primary">Slides nach Zone</h3>
            <p className="text-sm text-spa-text-secondary mt-1">
              Ziehe die Slides um die Reihenfolge innerhalb einer Zone zu ändern
            </p>
          </div>

          {localConfig.slides.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-spa-text-secondary mb-4">Noch keine Slides konfiguriert</p>
              <button
                onClick={() => handleAddSlide(zones[0]?.id || 'main')}
                className="px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors"
              >
                Ersten Slide hinzufügen
              </button>
            </div>
          ) : (
            <div className={clsx(
              'grid gap-6 p-6',
              zones.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'
            )}>
              {zones.map((zone) => {
                const zoneSlides = getSlidesByZone(localConfig.slides, zone.id);
                return (
                  <div key={zone.id} className="bg-spa-bg-primary/30 rounded-lg border-2 border-spa-bg-secondary">
                    {/* Zone Header */}
                    <div className="p-4 border-b border-spa-bg-secondary bg-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-spa-text-primary">{zone.name}</h4>
                          <p className="text-xs text-spa-text-secondary mt-0.5">
                            {zone.type === 'persistent' ? 'Persistent' : 'Rotierend'} • {zoneSlides.length} Slide{zoneSlides.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAddSlide(zone.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-spa-secondary text-white rounded-md hover:bg-spa-secondary-dark transition-colors text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Slide
                        </button>
                      </div>
                    </div>

                    {/* Zone Slides */}
                    {zoneSlides.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-spa-text-secondary text-sm">Keine Slides in dieser Zone</p>
                      </div>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd(zone.id)}
                      >
                        <SortableContext
                          items={zoneSlides.map((s) => s.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="divide-y divide-spa-bg-secondary">
                            {zoneSlides.map((slide, index) => (
                              <SortableSlideItem
                                key={slide.id}
                                slide={slide}
                                index={index}
                                onToggleEnabled={handleToggleEnabled}
                                onEdit={handleEditSlide}
                                onDelete={handleDeleteSlide}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Global Settings */}
          <div className="p-6 border-t border-spa-bg-secondary bg-spa-bg-primary/30">
            <h4 className="font-semibold text-spa-text-primary mb-4">Globale Einstellungen</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-spa-text-primary mb-2">
                  Standard-Dauer (Sekunden)
                </label>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={localConfig.defaultDuration}
                  onChange={(e) => {
                    setLocalConfig({
                      ...localConfig,
                      defaultDuration: parseInt(e.target.value) || 10,
                    });
                    setIsDirty(true);
                  }}
                  className="w-full px-3 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-spa-text-primary mb-2">
                  Standard-Übergang
                </label>
                <select
                  value={localConfig.defaultTransition}
                  onChange={(e) => {
                    setLocalConfig({
                      ...localConfig,
                      defaultTransition: e.target.value as any,
                    });
                    setIsDirty(true);
                  }}
                  className="w-full px-3 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                >
                  <option value="fade">Fade</option>
                  <option value="slide">Slide</option>
                  <option value="zoom">Zoom</option>
                  <option value="none">Keine</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localConfig.showSlideIndicators}
                    onChange={(e) => {
                      setLocalConfig({
                        ...localConfig,
                        showSlideIndicators: e.target.checked,
                      });
                      setIsDirty(true);
                    }}
                    className="w-4 h-4 text-spa-primary border-gray-300 rounded focus:ring-spa-primary"
                  />
                  <span className="text-sm font-medium text-spa-text-primary">
                    Slide-Indikatoren anzeigen
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => window.open('/display', '_blank')}
            className="flex items-center gap-2 px-6 py-3 bg-spa-accent text-spa-text-primary rounded-md hover:bg-spa-accent-warm transition-colors font-medium"
          >
            <Play className="w-5 h-5" />
            Vorschau öffnen
          </button>
        </div>

        {/* Slide Editor Dialog */}
        <SlideEditor
          slide={editingSlide || (isAddingNew ? createEmptySlide(0, selectedZone) : null)}
          isOpen={editingSlide !== null || isAddingNew}
          onClose={() => {
            setEditingSlide(null);
            setIsAddingNew(false);
          }}
          onSave={(slide) =>
            editingSlide ? handleSaveEditSlide(slide as SlideConfig) : handleSaveNewSlide(slide as Omit<SlideConfig, 'id'>)
          }
        />

        <DeviceOverridesDialog
          device={overrideDevice}
          isOpen={Boolean(overrideDevice)}
          onClose={() => setOverrideDevice(null)}
        />
      </div>
    </Layout>
  );
}
