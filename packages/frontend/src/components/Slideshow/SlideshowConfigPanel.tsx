import { useEffect, useMemo, useState } from 'react';
import { DisplayLivePreview } from '@/components/Display/DisplayLivePreview';
import { AudioConfigEditor } from '@/components/Settings/AudioConfigEditor';
import { GlobalSlideshowSettings } from '@/components/Slideshow/GlobalSlideshowSettings';
import { LayoutPicker } from '@/components/Slideshow/LayoutPicker';
import { SlideEditor } from '@/components/Slideshow/SlideEditor';
import { SlidePreview } from '@/components/Slideshow/SlidePreview';
import type { Schedule } from '@/types/schedule.types';
import type { AudioSettings, Settings } from '@/types/settings.types';
import type { LayoutType, SlideConfig, SlideshowConfig } from '@/types/slideshow.types';
import {
  createEmptySlide,
  getEnabledSlides,
  getSlidesByZone,
  getZonesForLayout,
  reorderSlides,
} from '@/types/slideshow.types';
import { Edit, Eye, EyeOff, GripVertical, Plus, Play, Trash2 } from 'lucide-react';
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

interface SortableSlideItemProps {
  slide: SlideConfig;
  index: number;
  disabled?: boolean;
  onToggleEnabled: (id: string) => void;
  onEdit: (slide: SlideConfig) => void;
  onDelete: (id: string) => void;
}

interface SlideshowConfigPanelProps {
  config: SlideshowConfig;
  previewSchedule: Schedule;
  previewSettings: Settings;
  isDirty?: boolean;
  disabled?: boolean;
  showOpenPreviewButton?: boolean;
  previewButtonLabel?: string;
  onChange: (next: SlideshowConfig) => void;
  showAudioOverride?: boolean;
  audioOverride?: AudioSettings | null;
  onAudioOverrideChange?: (audio: AudioSettings | null) => void;
  audioTitle?: string;
  audioSubtitle?: string;
  audioEnableLabel?: string;
  audioEnableDescription?: string;
}

const DEFAULT_AUDIO_OVERRIDE: AudioSettings = {
  enabled: false,
  volume: 0.5,
  loop: true,
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

function SortableSlideItem({
  slide,
  index,
  disabled = false,
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

  const dragHandleProps = disabled ? {} : { ...attributes, ...listeners };

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
      <div
        {...dragHandleProps}
        className={clsx(
          'flex items-center touch-none',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing'
        )}
      >
        <GripVertical className="w-5 h-5 text-spa-text-secondary hover:text-spa-primary" />
      </div>

      <SlidePreview slide={slide} />

      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-spa-primary text-white flex items-center justify-center font-bold text-sm">
        {index + 1}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-spa-text-primary">{slide.title || slide.type}</span>
          <span className="text-xs px-2 py-0.5 bg-spa-secondary/20 text-spa-secondary-dark rounded-full">
            {slide.type}
          </span>
        </div>
        <div className="text-sm text-spa-text-secondary">
          Dauer: {slide.duration}s
          {slide.transition && ` • Übergang: ${slide.transition}`}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggleEnabled(slide.id)}
          disabled={disabled}
          className={clsx(
            'p-2 rounded-md transition-colors disabled:opacity-40',
            slide.enabled
              ? 'text-spa-primary hover:bg-spa-primary/10'
              : 'text-spa-text-secondary hover:bg-spa-bg-secondary'
          )}
          title={slide.enabled ? 'Deaktivieren' : 'Aktivieren'}
        >
          {slide.enabled ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </button>

        <button
          onClick={() => onEdit(slide)}
          disabled={disabled}
          className="p-2 text-spa-secondary hover:bg-spa-secondary/10 rounded-md transition-colors disabled:opacity-40"
          title="Bearbeiten"
        >
          <Edit className="w-5 h-5" />
        </button>

        <button
          onClick={() => onDelete(slide.id)}
          disabled={disabled}
          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40"
          title="Löschen"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export function SlideshowConfigPanel({
  config,
  previewSchedule,
  previewSettings,
  isDirty = false,
  disabled = false,
  showOpenPreviewButton = true,
  previewButtonLabel = 'Vorschau öffnen',
  onChange,
  showAudioOverride = false,
  audioOverride = null,
  onAudioOverrideChange,
  audioTitle = 'Audio-Override',
  audioSubtitle = 'Musik für diese Slideshow-Ausgabe konfigurieren.',
  audioEnableLabel = 'Audio-Override aktivieren',
  audioEnableDescription = 'Wird für diesen Zielkontext verwendet.',
}: SlideshowConfigPanelProps) {
  const [editingSlide, setEditingSlide] = useState<SlideConfig | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string>('main');

  const zones = useMemo(() => getZonesForLayout(config.layout), [config.layout]);
  const enabledSlides = useMemo(() => getEnabledSlides(config), [config]);
  useEffect(() => {
    const firstZone = zones[0]?.id || 'main';
    if (!zones.some((zone) => zone.id === selectedZone)) {
      setSelectedZone(firstZone);
    }
  }, [zones, selectedZone]);

  useEffect(() => {
    const slidesNeedingZone = config.slides.filter((slide) => !slide.zoneId);
    if (slidesNeedingZone.length === 0) return;

    const defaultZone = zones[0]?.id || 'main';
    const updatedSlides = config.slides.map((slide) => (
      slide.zoneId ? slide : { ...slide, zoneId: defaultZone }
    ));

    onChange({
      ...config,
      slides: updatedSlides,
    });
  }, [config, onChange, zones]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleLayoutChange = (layout: LayoutType) => {
    const firstZone = getZonesForLayout(layout)[0]?.id || 'main';
    setSelectedZone(firstZone);
    onChange({
      ...config,
      layout,
    });
  };

  const handleAddSlide = (zoneId: string = 'main') => {
    setSelectedZone(zoneId);
    setIsAddingNew(true);
  };

  const handleSaveNewSlide = (slideData: Omit<SlideConfig, 'id'> | SlideConfig) => {
    if ('id' in slideData) return;

    const zoneId = selectedZone || zones[0]?.id || 'main';
    const zoneSlides = getSlidesByZone(config.slides, zoneId);
    const newSlide: SlideConfig = {
      ...slideData,
      id: generateId(),
      zoneId,
      order: zoneSlides.length,
    };

    onChange({
      ...config,
      slides: [...config.slides, newSlide],
    });

    setIsAddingNew(false);
  };

  const handleSaveEditSlide = (slideData: Omit<SlideConfig, 'id'> | SlideConfig) => {
    if (!('id' in slideData)) return;

    onChange({
      ...config,
      slides: config.slides.map((slide) => (
        slide.id === slideData.id ? slideData : slide
      )),
    });

    setEditingSlide(null);
  };

  const handleDeleteSlide = (id: string) => {
    if (!window.confirm('Möchtest du diesen Slide wirklich löschen?')) return;

    const targetSlide = config.slides.find((slide) => slide.id === id);
    if (!targetSlide) return;

    const zoneId = targetSlide.zoneId || 'main';
    const zoneSlides = getSlidesByZone(config.slides, zoneId)
      .filter((slide) => slide.id !== id)
      .map((slide, index) => ({
        ...slide,
        zoneId,
        order: index,
      }));

    onChange(replaceZoneSlides(config, zoneId, zoneSlides));
  };

  const handleToggleEnabled = (id: string) => {
    onChange({
      ...config,
      slides: config.slides.map((slide) => (
        slide.id === id ? { ...slide, enabled: !slide.enabled } : slide
      )),
    });
  };

  const handleDragEnd = (zoneId: string) => (event: DragEndEvent) => {
    if (disabled) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const zoneSlides = getSlidesByZone(config.slides, zoneId);
    const oldIndex = zoneSlides.findIndex((slide) => slide.id === active.id);
    const newIndex = zoneSlides.findIndex((slide) => slide.id === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = reorderSlides(zoneSlides, oldIndex, newIndex).map((slide, index) => ({
      ...slide,
      zoneId,
      order: index,
    }));

    onChange(replaceZoneSlides(config, zoneId, reordered));
  };

  const canEditAudio = showAudioOverride && Boolean(onAudioOverrideChange);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-spa-text-primary">1:1 Monitor-Vorschau</h3>
            <p className="text-xs text-spa-text-secondary mt-1">
              Direkte Vorschau der echten `/display` Ansicht mit dieser Konfiguration.
            </p>
          </div>
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${
            isDirty ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
          }`}>
            {isDirty ? 'Ungespeicherte Änderungen aktiv' : 'Gespeicherter Stand'}
          </span>
        </div>

        <DisplayLivePreview
          schedule={previewSchedule}
          settings={previewSettings}
        />
      </div>

      {canEditAudio && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-spa-text-primary">{audioTitle}</h3>
              <p className="text-xs text-spa-text-secondary">{audioSubtitle}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(audioOverride)}
                onChange={(event) => {
                  if (!onAudioOverrideChange) return;
                  if (event.target.checked) {
                    onAudioOverrideChange(audioOverride || { ...DEFAULT_AUDIO_OVERRIDE });
                  } else {
                    onAudioOverrideChange(null);
                  }
                }}
                className="sr-only peer"
                disabled={disabled}
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-spa-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-spa-accent"></div>
            </label>
          </div>

          {audioOverride ? (
            <AudioConfigEditor
              audio={audioOverride}
              onChange={(nextAudio) => {
                if (!onAudioOverrideChange) return;
                onAudioOverrideChange(nextAudio);
              }}
              title={audioTitle}
              subtitle={audioSubtitle}
              showEnableToggle
              enableLabel={audioEnableLabel}
              enableDescription={audioEnableDescription}
            />
          ) : (
            <p className="text-sm text-spa-text-secondary">
              Kein Audio-Override aktiv.
            </p>
          )}
        </div>
      )}

      <LayoutPicker
        layout={config.layout}
        persistentZonePosition={config.persistentZonePosition}
        persistentZoneSize={config.persistentZoneSize}
        disabled={disabled}
        onLayoutChange={handleLayoutChange}
        onPersistentZonePositionChange={(position) => onChange({ ...config, persistentZonePosition: position })}
        onPersistentZoneSizeChange={(size) => onChange({ ...config, persistentZoneSize: size })}
      />

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-spa-bg-secondary">
          <h3 className="text-lg font-semibold text-spa-text-primary">Slides nach Zone</h3>
          <p className="text-sm text-spa-text-secondary mt-1">
            Ziehe die Slides, um die Reihenfolge innerhalb einer Zone zu ändern.
          </p>
          <p className="text-xs text-spa-text-secondary mt-2">
            {config.slides.length} Slide{config.slides.length !== 1 ? 's' : ''} ({enabledSlides.length} aktiv)
          </p>
        </div>

        {config.slides.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-spa-text-secondary mb-4">Noch keine Slides konfiguriert</p>
            <button
              onClick={() => handleAddSlide(zones[0]?.id || 'main')}
              disabled={disabled}
              className="px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors disabled:opacity-50"
            >
              Ersten Slide hinzufügen
            </button>
          </div>
        ) : (
          <div
            className={clsx(
              'grid gap-6 p-6',
              zones.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'
            )}
          >
            {zones.map((zone) => {
              const zoneSlides = getSlidesByZone(config.slides, zone.id);
              return (
                <div key={zone.id} className="bg-spa-bg-primary/30 rounded-lg border-2 border-spa-bg-secondary">
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
                        disabled={disabled}
                        className="flex items-center gap-1 px-3 py-1.5 bg-spa-secondary text-white rounded-md hover:bg-spa-secondary-dark transition-colors text-sm disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        Slide
                      </button>
                    </div>
                  </div>

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
                        items={zoneSlides.map((slide) => slide.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="divide-y divide-spa-bg-secondary">
                          {zoneSlides.map((slide, index) => (
                            <SortableSlideItem
                              key={slide.id}
                              slide={slide}
                              index={index}
                              disabled={disabled}
                              onToggleEnabled={handleToggleEnabled}
                              onEdit={(nextSlide) => setEditingSlide(nextSlide)}
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

        <GlobalSlideshowSettings config={config} disabled={disabled} onChange={onChange} />
      </div>

      {showOpenPreviewButton && (
        <div className="flex justify-end">
          <button
            onClick={() => window.open('/display', '_blank')}
            className="flex items-center gap-2 px-6 py-3 bg-spa-accent text-spa-text-primary rounded-md hover:bg-spa-accent-warm transition-colors font-medium"
          >
            <Play className="w-5 h-5" />
            {previewButtonLabel}
          </button>
        </div>
      )}

      <SlideEditor
        slide={editingSlide || (isAddingNew ? createEmptySlide(0, selectedZone) : null)}
        isOpen={editingSlide !== null || isAddingNew}
        onClose={() => {
          setEditingSlide(null);
          setIsAddingNew(false);
        }}
        onSave={(slide) => (
          editingSlide
            ? handleSaveEditSlide(slide as SlideConfig)
            : handleSaveNewSlide(slide as Omit<SlideConfig, 'id'>)
        )}
      />
    </div>
  );
}
