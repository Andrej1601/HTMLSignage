import { useEffect, useMemo, useState } from 'react';
import { DisplayScenarioPreview } from '@/components/Display/DisplayScenarioPreview';
import { GlobalSlideshowSettings } from '@/components/Slideshow/GlobalSlideshowSettings';
import { LayoutPicker } from '@/components/Slideshow/LayoutPicker';
import { SlideEditor } from '@/components/Slideshow/SlideEditor';
import { SlideListSection } from '@/components/Slideshow/SlideListSection';
import { AudioOverrideSection } from '@/components/Slideshow/AudioOverrideSection';
import type { Schedule } from '@/types/schedule.types';
import type { AudioSettings, Settings } from '@/types/settings.types';
import type { LayoutType, SlideConfig, SlideshowConfig } from '@/types/slideshow.types';
import {
  createEmptySlide,
  getSlidesByZone,
  getZonesForLayout,
} from '@/types/slideshow.types';
import { Play } from 'lucide-react';
import { SectionCard } from '@/components/SectionCard';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { generateId } from '@/utils/id';

interface SlideshowConfigPanelProps {
  config: SlideshowConfig;
  previewSchedule: Schedule;
  previewSettings: Settings;
  isDirty?: boolean;
  disabled?: boolean;
  prestartMinutes?: number;
  showOpenPreviewButton?: boolean;
  previewButtonLabel?: string;
  scenarioDefaultDeviceId?: string | null;
  scenarioAllowedDeviceIds?: string[];
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

export function SlideshowConfigPanel({
  config,
  previewSchedule,
  previewSettings,
  isDirty = false,
  disabled = false,
  prestartMinutes = 10,
  showOpenPreviewButton = true,
  previewButtonLabel = 'Vorschau öffnen',
  scenarioDefaultDeviceId: _scenarioDefaultDeviceId = null,
  scenarioAllowedDeviceIds: _scenarioAllowedDeviceIds,
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

  const zones = useMemo(() => getZonesForLayout(config.layout), [config.layout]);

  if (!zones.some((zone) => zone.id === selectedZone)) {
    setSelectedZone(zones[0]?.id || 'main');
  }

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
    const otherSlides = config.slides.filter((slide) => (slide.zoneId || 'main') !== zoneId);
    const zoneSlides = getSlidesByZone(config.slides, zoneId)
      .filter((slide) => slide.id !== deletingSlideId)
      .map((slide, index) => ({ ...slide, zoneId, order: index }));

    onChange({
      ...config,
      slides: [...otherSlides, ...zoneSlides],
    });
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

  const canEditAudio = showAudioOverride && Boolean(onAudioOverrideChange);

  return (
    <div className="space-y-6">
      <SectionCard
        title="1:1 Monitor-Vorschau"
        description="Direkte Vorschau der echten Display-Ansicht mit Szenario für Gerät, Uhrzeit und Override-Kontext."
        icon={Play}
        actions={
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${
            isDirty ? 'bg-spa-warning-light text-spa-warning-dark' : 'bg-spa-success-light text-spa-success-dark'
          }`}>
            {isDirty ? 'Ungespeicherte Änderungen' : 'Gespeicherter Stand'}
          </span>
        }
      >
        <DisplayScenarioPreview
          schedule={previewSchedule}
          settings={previewSettings}
        />
      </SectionCard>

      {canEditAudio && onAudioOverrideChange && (
        <AudioOverrideSection
          audioOverride={audioOverride}
          onAudioOverrideChange={onAudioOverrideChange}
          disabled={disabled}
          title={audioTitle}
          subtitle={audioSubtitle}
          enableLabel={audioEnableLabel}
          enableDescription={audioEnableDescription}
        />
      )}

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

      <SlideListSection
        config={config}
        disabled={disabled}
        onAddSlide={handleAddSlide}
        onEditSlide={(slide) => setEditingSlide(slide)}
        onDeleteSlide={handleDeleteSlide}
        onToggleEnabled={handleToggleEnabled}
        onChange={onChange}
      />

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
    </div>
  );
}
