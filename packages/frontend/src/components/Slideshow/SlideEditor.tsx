import { useState, useEffect } from 'react';
import type { SlideConfig, SlideType } from '@/types/slideshow.types';
import { SLIDE_TYPE_OPTIONS, getSlideTypeOption } from '@/types/slideshow.types';
import type { Sauna } from '@/types/sauna.types';
import type { Media } from '@/types/media.types';
import type { InfoItem } from '@/types/settings.types';
import { useSettings } from '@/hooks/useSettings';
import { useMedia } from '@/hooks/useMedia';
import { buildUploadUrl } from '@/utils/mediaUrl';
import { X, Save, Clock, Film } from 'lucide-react';
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

  const saunas: Sauna[] = settings?.saunas || [];
  const infos: InfoItem[] = settings?.infos || [];
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

    // Validation
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
    // Reset type-specific fields when changing type
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
                  <div className="font-semibold text-sm text-spa-text-primary">
                    {option.label}
                  </div>
                  <div className="text-xs text-spa-text-secondary mt-1">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Sauna Selection (if required) */}
          {slideTypeOption?.requiresSauna && (
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Sauna auswählen *
              </label>
              {saunas.length === 0 ? (
                <p className="text-sm text-red-600">
                  Keine Saunas konfiguriert. Bitte erstelle zuerst Saunas.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {saunas.map((sauna) => (
                    <button
                      key={sauna.id}
                      onClick={() => setFormData({ ...formData, saunaId: sauna.id })}
                      className={clsx(
                        'p-3 rounded-lg border-2 transition-all text-left',
                        formData.saunaId === sauna.id
                          ? 'border-spa-primary bg-spa-primary/5'
                          : 'border-spa-bg-secondary hover:border-spa-primary/50'
                      )}
                      style={{
                        borderColor:
                          formData.saunaId === sauna.id ? undefined : sauna.color,
                      }}
                    >
                      <div className="font-semibold text-spa-text-primary">{sauna.name}</div>
                      {sauna.info?.temperature && (
                        <div className="text-xs text-spa-text-secondary mt-1">
                          {sauna.info.temperature}°C
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Media Selection (if required) */}
          {slideTypeOption?.requiresMedia && (
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                {slideTypeOption.supportsVideo ? 'Video auswählen' : 'Bild auswählen'} *
              </label>
              {slideTypeOption.supportsVideo ? (
                // Video selection
                videos.length === 0 ? (
                  <p className="text-sm text-red-600">
                    Keine Videos hochgeladen. Bitte lade zuerst Videos hoch.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                    {videos.map((video: Media) => (
                      <button
                        key={video.id}
                        onClick={() => setFormData({ ...formData, mediaId: video.id })}
                        className={clsx(
                          'relative rounded-lg border-2 overflow-hidden transition-all group',
                          formData.mediaId === video.id
                            ? 'border-spa-primary ring-2 ring-spa-primary'
                            : 'border-spa-bg-secondary hover:border-spa-primary/50'
                        )}
                      >
                        <div className="relative w-full h-24 bg-gray-900">
                          <video
                            src={buildUploadUrl(video.filename)}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
                            <Film className="w-8 h-8 text-white" />
                          </div>
                        </div>
                        <div className="px-2 py-1 text-xs text-spa-text-primary truncate bg-white">
                          {video.originalName}
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                // Image selection
                images.length === 0 ? (
                  <p className="text-sm text-red-600">
                    Keine Bilder hochgeladen. Bitte lade zuerst Bilder hoch.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                    {images.map((img: Media) => (
                      <button
                        key={img.id}
                        onClick={() => setFormData({ ...formData, mediaId: img.id })}
                        className={clsx(
                          'relative rounded-lg border-2 overflow-hidden transition-all',
                          formData.mediaId === img.id
                            ? 'border-spa-primary ring-2 ring-spa-primary'
                            : 'border-spa-bg-secondary hover:border-spa-primary/50'
                        )}
                      >
                        <img
                          src={buildUploadUrl(img.filename)}
                          alt={img.originalName}
                          className="w-full h-24 object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {/* Video Playback Mode (if video) */}
          {formData.type === 'media-video' && (
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Video-Wiedergabe
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() =>
                    setFormData({ ...formData, videoPlayback: 'duration' })
                  }
                  className={clsx(
                    'p-3 rounded-lg border-2 transition-all',
                    formData.videoPlayback === 'duration' ||
                      !formData.videoPlayback
                      ? 'border-spa-primary bg-spa-primary/5'
                      : 'border-spa-bg-secondary hover:border-spa-primary/50'
                  )}
                >
                  <Clock className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-xs font-semibold">Feste Dauer</div>
                  <div className="text-xs text-spa-text-secondary mt-1">
                    Loop bei Bedarf
                  </div>
                </button>
                <button
                  onClick={() =>
                    setFormData({ ...formData, videoPlayback: 'complete' })
                  }
                  className={clsx(
                    'p-3 rounded-lg border-2 transition-all',
                    formData.videoPlayback === 'complete'
                      ? 'border-spa-primary bg-spa-primary/5'
                      : 'border-spa-bg-secondary hover:border-spa-primary/50'
                  )}
                >
                  <Film className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-xs font-semibold">Bis Ende</div>
                  <div className="text-xs text-spa-text-secondary mt-1">
                    Spielt bis zum Ende
                  </div>
                </button>
                <button
                  onClick={() =>
                    setFormData({ ...formData, videoPlayback: 'loop-duration' })
                  }
                  className={clsx(
                    'p-3 rounded-lg border-2 transition-all',
                    formData.videoPlayback === 'loop-duration'
                      ? 'border-spa-primary bg-spa-primary/5'
                      : 'border-spa-bg-secondary hover:border-spa-primary/50'
                  )}
                >
                  <Film className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-xs font-semibold">Loop</div>
                  <div className="text-xs text-spa-text-secondary mt-1">
                    Loop für Dauer
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Info Selection (Infos Slide) */}
          {formData.type === 'infos' && (
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Info auswählen *
              </label>
              {infos.length === 0 ? (
                <p className="text-sm text-red-600">
                  Keine Infos konfiguriert. Bitte lege zuerst Infos unter Einstellungen → Infos an.
                </p>
              ) : (
                <div className="space-y-2">
                  <select
                    value={formData.infoId || ''}
                    onChange={(e) => setFormData({ ...formData, infoId: e.target.value || undefined })}
                    className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                  >
                    <option value="">Bitte wählen...</option>
                    {infos.map((info) => (
                      <option key={info.id} value={info.id}>
                        {info.title}
                      </option>
                    ))}
                  </select>
                  {formData.infoId && (
                    <div className="text-xs text-spa-text-secondary bg-spa-bg-primary rounded-md p-3 border border-spa-bg-secondary">
                      {infos.find((i) => i.id === formData.infoId)?.text}
                    </div>
                  )}
                </div>
              )}
            </div>
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
              onChange={(e) =>
                setFormData({ ...formData, duration: parseInt(e.target.value) || 1 })
              }
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
                onChange={(e) =>
                  setFormData({ ...formData, showTitle: e.target.checked })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, enabled: e.target.checked })
                }
                className="w-4 h-4 text-spa-primary border-gray-300 rounded focus:ring-spa-primary"
              />
              <span className="text-sm font-medium text-spa-text-primary">
                Slide aktiviert
              </span>
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
