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
  getSlideTypeOption,
  getZonesForLayout,
  reorderSlides,
} from '@/types/slideshow.types';
import { Edit, Eye, EyeOff, GripVertical, Layers, Plus, Play, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/SectionCard';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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
import { SLIDESHOW_TEMPLATES, applySlideshowTemplate } from './slideshowTemplates';

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
  prestartMinutes?: number;
  showOpenPreviewButton?: boolean;
  previewButtonLabel?: string;
  onChange: (next: SlideshowConfig) => void;
  onPrestartMinutesChange?: (minutes: number) => void;
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

  const typeOption = getSlideTypeOption(slide.type);
  const typeLabel = typeOption?.label || slide.type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'px-3 py-2.5 flex items-center gap-3 hover:bg-spa-bg-primary/50 transition-colors',
        !slide.enabled && 'opacity-40',
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
        <GripVertical className="w-4 h-4 text-spa-text-secondary hover:text-spa-primary" />
      </div>

      <SlidePreview slide={slide} />

      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-spa-primary text-white flex items-center justify-center font-bold text-xs">
        {index + 1}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={clsx('font-semibold text-sm text-spa-text-primary', !slide.enabled && 'line-through')}>
            {slide.title || typeLabel}
          </span>
          <span className="text-[11px] px-2 py-0.5 bg-spa-secondary/15 text-spa-secondary-dark rounded-full">
            {typeLabel}
          </span>
          {!slide.enabled && (
            <span className="text-[11px] px-2 py-0.5 bg-spa-error-light text-spa-error-dark rounded-full font-medium">
              Deaktiviert
            </span>
          )}
        </div>
        <div className="text-xs text-spa-text-secondary mt-0.5">
          {slide.duration}s
          {slide.transition && slide.transition !== 'none' && ` · ${slide.transition}`}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onToggleEnabled(slide.id)}
          disabled={disabled}
          className={clsx(
            'p-1.5 rounded-md transition-colors disabled:opacity-40',
            slide.enabled
              ? 'text-spa-primary hover:bg-spa-primary/10'
              : 'text-spa-text-secondary hover:bg-spa-bg-secondary'
          )}
          title={slide.enabled ? 'Deaktivieren' : 'Aktivieren'}
          aria-label={slide.enabled ? 'Slide deaktivieren' : 'Slide aktivieren'}
        >
          {slide.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>

        <button
          onClick={() => onEdit(slide)}
          disabled={disabled}
          className="p-1.5 text-spa-secondary hover:bg-spa-secondary/10 rounded-md transition-colors disabled:opacity-40"
          title="Bearbeiten"
          aria-label="Slide bearbeiten"
        >
          <Edit className="w-4 h-4" />
        </button>

        <button
          onClick={() => onDelete(slide.id)}
          disabled={disabled}
          className="p-1.5 text-spa-error hover:bg-spa-error-light rounded-md transition-colors disabled:opacity-40"
          title="Löschen"
          aria-label="Slide löschen"
        >
          <Trash2 className="w-4 h-4" />
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
  prestartMinutes = 10,
  showOpenPreviewButton = true,
  previewButtonLabel = 'Vorschau öffnen',
  onChange,
  onPrestartMinutesChange,
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
  const [deletingSlideId, setDeletingSlideId] = useState<string | null>(null);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

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
    setDeletingSlideId(id);
  };

  const confirmDeleteSlide = () => {
    if (!deletingSlideId) return;

    const targetSlide = config.slides.find((slide) => slide.id === deletingSlideId);
    if (!targetSlide) { setDeletingSlideId(null); return; }

    const zoneId = targetSlide.zoneId || 'main';
    const zoneSlides = getSlidesByZone(config.slides, zoneId)
      .filter((slide) => slide.id !== deletingSlideId)
      .map((slide, index) => ({
        ...slide,
        zoneId,
        order: index,
      }));

    onChange(replaceZoneSlides(config, zoneId, zoneSlides));
    setDeletingSlideId(null);
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
  const pendingTemplate = pendingTemplateId
    ? SLIDESHOW_TEMPLATES.find((template) => template.id === pendingTemplateId) || null
    : null;

  return (
    <div className="space-y-6">
      <SectionCard
        title="1:1 Monitor-Vorschau"
        description="Direkte Vorschau der echten Display-Ansicht mit dieser Konfiguration."
        icon={Play}
        actions={
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${
            isDirty ? 'bg-spa-warning-light text-spa-warning-dark' : 'bg-spa-success-light text-spa-success-dark'
          }`}>
            {isDirty ? 'Ungespeicherte Änderungen' : 'Gespeicherter Stand'}
          </span>
        }
      >
        <DisplayLivePreview
          schedule={previewSchedule}
          settings={previewSettings}
        />
      </SectionCard>

      {canEditAudio && (
        <SectionCard
          title={audioTitle}
          description={audioSubtitle}
          actions={
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
              <div className="w-11 h-6 bg-spa-bg-secondary peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-spa-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-spa-accent"></div>
            </label>
          }
        >
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
        </SectionCard>
      )}

      <SectionCard
        title="Schnellstart-Vorlagen"
        description="Vorgebaute Slideshow-Grundgerüste für typische Wellness- und Event-Szenarien."
        icon={Layers}
      >
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          {SLIDESHOW_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setPendingTemplateId(template.id)}
              disabled={disabled}
              className={clsx(
                'rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50',
                template.accent === 'primary' && 'border-spa-primary/20 bg-spa-primary/5',
                template.accent === 'info' && 'border-spa-info/20 bg-spa-info-light/50',
                template.accent === 'success' && 'border-spa-success/20 bg-spa-success-light/50',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-spa-text-primary">{template.label}</span>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-spa-text-secondary">
                  {template.layout}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-spa-text-secondary">
                {template.description}
              </p>
            </button>
          ))}
        </div>
      </SectionCard>

      <LayoutPicker
        layout={config.layout}
        disabled={disabled}
        onLayoutChange={handleLayoutChange}
      />

      <GlobalSlideshowSettings
        config={config}
        prestartMinutes={prestartMinutes}
        disabled={disabled}
        onChange={onChange}
        onPrestartMinutesChange={onPrestartMinutesChange}
      />

      <SectionCard
        title="Slides nach Zone"
        description={`${config.slides.length} Slide${config.slides.length !== 1 ? 's' : ''} konfiguriert (${enabledSlides.length} aktiv). Per Drag & Drop die Reihenfolge ändern.`}
        icon={Layers}
        noPadding
      >
        {config.slides.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="w-12 h-12 text-spa-text-secondary mx-auto mb-3" />
            <p className="text-spa-text-secondary mb-4">Noch keine Slides konfiguriert</p>
            <Button
              icon={Plus}
              onClick={() => handleAddSlide(zones[0]?.id || 'main')}
              disabled={disabled}
            >
              Ersten Slide hinzufügen
            </Button>
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
                <div key={zone.id} className="rounded-lg border border-spa-bg-secondary overflow-hidden">
                  <div className="px-4 py-3 border-b border-spa-bg-secondary bg-spa-bg-primary/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-sm text-spa-text-primary">{zone.name}</h4>
                        <p className="text-xs text-spa-text-secondary mt-0.5">
                          {zone.type === 'persistent' ? 'Persistent' : 'Rotierend'} · {zoneSlides.length} Slide{zoneSlides.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Plus}
                        onClick={() => handleAddSlide(zone.id)}
                        disabled={disabled}
                      >
                        Slide
                      </Button>
                    </div>
                  </div>

                  {zoneSlides.length === 0 ? (
                    <div className="p-8 text-center">
                      <Layers className="w-8 h-8 text-spa-text-secondary mx-auto mb-2" />
                      <p className="text-sm font-medium text-spa-text-secondary mb-1">Noch keine Slides</p>
                      <p className="text-xs text-spa-text-secondary mb-3">
                        {zone.type === 'persistent'
                          ? 'Persistente Zone — Inhalt wird dauerhaft angezeigt.'
                          : 'Rotierende Zone — Slides wechseln automatisch.'}
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Plus}
                        onClick={() => handleAddSlide(zone.id)}
                        disabled={disabled}
                      >
                        Slide hinzufügen
                      </Button>
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
      </SectionCard>

      {showOpenPreviewButton && (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            icon={Play}
            onClick={() => window.open('/display', '_blank')}
          >
            {previewButtonLabel}
          </Button>
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

      <ConfirmDialog
        isOpen={Boolean(deletingSlideId)}
        title="Slide löschen?"
        message={`Möchtest du diesen Slide wirklich löschen?`}
        confirmLabel="Löschen"
        variant="danger"
        onConfirm={confirmDeleteSlide}
        onCancel={() => setDeletingSlideId(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingTemplate)}
        title="Vorlage anwenden?"
        message={pendingTemplate
          ? `Die Vorlage "${pendingTemplate.label}" ersetzt die aktuelle Slide-Struktur und das Layout. Bereits gesetzte globale Einstellungen bleiben erhalten.`
          : 'Vorlage anwenden?'
        }
        confirmLabel="Vorlage anwenden"
        onConfirm={() => {
          if (!pendingTemplate) return;
          onChange(applySlideshowTemplate(config, pendingTemplate));
          setPendingTemplateId(null);
        }}
        onCancel={() => setPendingTemplateId(null)}
      />
    </div>
  );
}
