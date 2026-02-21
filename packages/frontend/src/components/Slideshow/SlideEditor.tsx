import { useState, useEffect } from 'react';
import type { SlideConfig, SlideType } from '@/types/slideshow.types';
import { SLIDE_TYPE_OPTIONS, getSlideTypeOption } from '@/types/slideshow.types';
import type { Media } from '@/types/media.types';
import { useSettings } from '@/hooks/useSettings';
import { useMedia } from '@/hooks/useMedia';
import { SaunaPickerField } from './slide-forms/SaunaPickerField';
import { MediaPickerField } from './slide-forms/MediaPickerField';
import { VideoPlaybackField } from './slide-forms/VideoPlaybackField';
import { InfoPickerField } from './slide-forms/InfoPickerField';
import { X, Save } from 'lucide-react';
import clsx from 'clsx';

interface SlideEditorProps {
  slide: Omit<SlideConfig, 'id'> | SlideConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (slide: Omit<SlideConfig, 'id'> | SlideConfig) => void;
}

export function SlideEditor({ slide, isOpen, onClose, onSave }: SlideEditorProps) {
  const { settings } = useSettings();
  const { data: media } = useMedia();

  const saunas = settings?.saunas || [];
  const infos = settings?.infos || [];
  const images = media?.filter((m: Media) => m.type === 'image') || [];
  const videos = media?.filter((m: Media) => m.type === 'video') || [];

  const [formData, setFormData] = useState<Omit<SlideConfig, 'id'>>({
    type: 'content-panel',
    enabled: true,
    duration: 10,
    order: 0,
    showTitle: true,
    transition: 'fade',
  });

  useEffect(() => {
    if (slide) {
      setFormData({
        type: slide.type,
        enabled: slide.enabled,
        duration: slide.duration,
        order: slide.order,
        saunaId: slide.saunaId,
        mediaId: slide.mediaId,
        videoPlayback: slide.videoPlayback,
        infoId: slide.infoId,
        title: slide.title,
        showTitle: slide.showTitle,
        transition: slide.transition,
        customCss: slide.customCss,
        notes: slide.notes,
      });
    } else {
      setFormData({
        type: 'content-panel',
        enabled: true,
        duration: 10,
        order: 0,
        showTitle: true,
        transition: 'fade',
      });
    }
  }, [slide, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const slideTypeOption = getSlideTypeOption(formData.type);

    if (slideTypeOption?.requiresSauna && !formData.saunaId) {
      alert('Bitte wähle eine Sauna aus');
      return;
    }
    if (slideTypeOption?.requiresMedia && !formData.mediaId) {
      alert('Bitte wähle ein Medium aus');
      return;
    }
    if (formData.type === 'infos' && infos.length > 0 && !formData.infoId) {
      alert('Bitte wähle eine Info aus');
      return;
    }
    if (formData.duration < 1) {
      alert('Dauer muss mindestens 1 Sekunde sein');
      return;
    }

    if (slide && 'id' in slide) {
      onSave({ ...slide, ...formData });
    } else {
      onSave(formData);
    }
  };

  const handleTypeChange = (newType: SlideType) => {
    setFormData({
      ...formData,
      type: newType,
      saunaId: undefined,
      mediaId: undefined,
      videoPlayback: undefined,
      infoId: undefined,
    });
  };

  const slideTypeOption = getSlideTypeOption(formData.type);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-spa-bg-secondary sticky top-0 bg-white z-10">
          <h3 className="text-xl font-semibold text-spa-text-primary">
            {slide && 'id' in slide ? 'Slide bearbeiten' : 'Neuer Slide'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-spa-text-secondary hover:bg-spa-bg-primary rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Slide Type */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-3">
              Slide-Typ *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {SLIDE_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  onClick={() => handleTypeChange(option.type)}
                  className={clsx(
                    'p-3 rounded-lg border-2 transition-all text-left',
                    formData.type === option.type
                      ? 'border-spa-primary bg-spa-primary/5'
                      : 'border-spa-bg-secondary hover:border-spa-primary/50'
                  )}
                >
                  <div className="text-2xl mb-1">{option.icon}</div>
                  <div className="font-semibold text-sm text-spa-text-primary">{option.label}</div>
                  <div className="text-xs text-spa-text-secondary mt-1">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Type-specific fields */}
          {slideTypeOption?.requiresSauna && (
            <SaunaPickerField
              saunas={saunas}
              selectedId={formData.saunaId}
              onSelect={(id) => setFormData({ ...formData, saunaId: id })}
            />
          )}

          {slideTypeOption?.requiresMedia && (
            <MediaPickerField
              supportsVideo={slideTypeOption.supportsVideo}
              images={images}
              videos={videos}
              selectedId={formData.mediaId}
              onSelect={(id) => setFormData({ ...formData, mediaId: id })}
            />
          )}

          {formData.type === 'media-video' && (
            <VideoPlaybackField
              value={formData.videoPlayback}
              onChange={(mode) => setFormData({ ...formData, videoPlayback: mode })}
            />
          )}

          {formData.type === 'infos' && (
            <InfoPickerField
              infos={infos}
              selectedId={formData.infoId}
              onSelect={(id) => setFormData({ ...formData, infoId: id })}
            />
          )}

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Anzeigedauer (Sekunden) *
            </label>
            <input
              type="number"
              min="1"
              max="300"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 1 })}
              className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
            />
            {formData.type === 'media-video' && formData.videoPlayback === 'complete' && (
              <p className="text-xs text-spa-text-secondary mt-1">
                Wird ignoriert wenn Video bis zum Ende abgespielt wird
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Titel (optional)
            </label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
              placeholder="Überschreibt Standard-Titel"
            />
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.showTitle ?? true}
                onChange={(e) => setFormData({ ...formData, showTitle: e.target.checked })}
                className="w-4 h-4 text-spa-primary border-gray-300 rounded focus:ring-spa-primary"
              />
              <span className="text-sm text-spa-text-secondary">Titel anzeigen</span>
            </label>
          </div>

          {/* Transition */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Übergangseffekt
            </label>
            <select
              value={formData.transition || 'fade'}
              onChange={(e) =>
                setFormData({ ...formData, transition: e.target.value as SlideConfig['transition'] })
              }
              className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
            >
              <option value="fade">Fade</option>
              <option value="slide">Slide</option>
              <option value="zoom">Zoom</option>
              <option value="none">Keine</option>
            </select>
          </div>

          {/* Enabled Toggle */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-4 h-4 text-spa-primary border-gray-300 rounded focus:ring-spa-primary"
              />
              <span className="text-sm font-medium text-spa-text-primary">Slide aktiviert</span>
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Notizen (optional)
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
              rows={3}
              placeholder="Interne Notizen zu diesem Slide..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-6 border-t border-spa-bg-secondary sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 text-spa-text-secondary hover:bg-spa-bg-secondary rounded-md transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors"
          >
            <Save className="w-4 h-4" />
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
