import { useMemo } from 'react';
import { Edit, Eye, EyeOff, GripVertical, Layers, Plus, Trash2 } from 'lucide-react';
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
import { SectionCard } from '@/components/SectionCard';
import { Button } from '@/components/Button';
import { SlidePreview } from '@/components/Slideshow/SlidePreview';
import type { SlideConfig, SlideshowConfig } from '@/types/slideshow.types';
import {
  getEnabledSlides,
  getSlideTypeOption,
  getSlidesByZone,
  getZonesForLayout,
  reorderSlides,
} from '@/types/slideshow.types';

interface SlideListSectionProps {
  config: SlideshowConfig;
  disabled?: boolean;
  onAddSlide: (zoneId: string) => void;
  onEditSlide: (slide: SlideConfig) => void;
  onDeleteSlide: (id: string) => void;
  onToggleEnabled: (id: string) => void;
  onChange: (next: SlideshowConfig) => void;
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

interface SortableSlideItemProps {
  slide: SlideConfig;
  index: number;
  disabled?: boolean;
  onToggleEnabled: (id: string) => void;
  onEdit: (slide: SlideConfig) => void;
  onDelete: (id: string) => void;
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
        role="button"
        tabIndex={0}
        aria-label={`Slide ${index + 1} verschieben: ${slide.title || typeLabel}`}
        aria-roledescription="Drag-Handle"
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

export function SlideListSection({
  config,
  disabled = false,
  onAddSlide,
  onEditSlide,
  onDeleteSlide,
  onToggleEnabled,
  onChange,
}: SlideListSectionProps) {
  const zones = useMemo(() => getZonesForLayout(config.layout), [config.layout]);
  const enabledSlides = useMemo(() => getEnabledSlides(config), [config]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  return (
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
            onClick={() => onAddSlide(zones[0]?.id || 'main')}
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
                      onClick={() => onAddSlide(zone.id)}
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
                      onClick={() => onAddSlide(zone.id)}
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
                            onToggleEnabled={onToggleEnabled}
                            onEdit={onEditSlide}
                            onDelete={onDeleteSlide}
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
  );
}
