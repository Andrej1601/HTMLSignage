import { useMemo, useState } from 'react';
import { Music, Upload, RefreshCw, Presentation, Play, Square, Volume2 } from 'lucide-react';
import { useMedia, useUploadMedia } from '@/hooks/useMedia';
import { useSlideshows, useUpdateSlideshow } from '@/hooks/useSlideshows';
import type { AudioSettings } from '@/types/settings.types';
import type { Media } from '@/types/media.types';
import type { SlideshowDefinition, SlideshowConfig } from '@/types/slideshow.types';
import { toAbsoluteMediaUrl } from '@/utils/mediaUrl';

interface AudioConfigEditorProps {
  audio: AudioSettings;
  onChange: (audio: AudioSettings) => void;
  title?: string;
  subtitle?: string;
  showEnableToggle?: boolean;
  enableLabel?: string;
  enableDescription?: string;
}

function toRelativeUploadPath(filename: string): string {
  return `/uploads/${filename}`;
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

export function AudioConfigEditor({
  audio,
  onChange,
  title = 'Audio-Verwaltung',
  subtitle = 'Audio pro Slideshow konfigurieren',
}: AudioConfigEditorProps) {
  const { data: media } = useMedia({ type: 'audio' });
  const uploadMedia = useUploadMedia();
  const { data: slideshows = [] } = useSlideshows();
  const updateSlideshow = useUpdateSlideshow();
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);

  const audioItems = useMemo(
    () => (media || []).filter((item: Media) => item.type === 'audio'),
    [media],
  );

  const getMediaById = (id?: string) => audioItems.find((a) => a.id === id);

  // Keep global settings in sync (for backward compat with displays)
  const syncGlobalAudio = (patch: Partial<AudioSettings>) => {
    onChange({ ...audio, ...patch });
  };

  const handleSlideshowAudioChange = (show: SlideshowDefinition, mediaId: string | undefined) => {
    const mediaItem = mediaId ? getMediaById(mediaId) : undefined;
    const audioOverride: AudioSettings | undefined = mediaItem
      ? {
          enabled: true,
          mediaId: mediaItem.id,
          src: toRelativeUploadPath(mediaItem.filename),
          volume: show.config.audioOverride?.volume ?? 0.5,
          loop: show.config.audioOverride?.loop ?? true,
        }
      : undefined;

    const config: SlideshowConfig = { ...show.config, audioOverride };
    updateSlideshow.mutate({ id: show.id, updates: { config } });

    // Sync first slideshow audio as global fallback
    if (show.isDefault && mediaItem) {
      syncGlobalAudio({
        enabled: true,
        mediaId: mediaItem.id,
        src: toRelativeUploadPath(mediaItem.filename),
      });
    }
  };

  const handleSlideshowVolumeChange = (show: SlideshowDefinition, volume: number) => {
    if (!show.config.audioOverride) return;
    const audioOverride: AudioSettings = { ...show.config.audioOverride, volume: clampVolume(volume) };
    const config: SlideshowConfig = { ...show.config, audioOverride };
    updateSlideshow.mutate({ id: show.id, updates: { config } });
  };

  const handleSlideshowLoopChange = (show: SlideshowDefinition, loop: boolean) => {
    if (!show.config.audioOverride) return;
    const audioOverride: AudioSettings = { ...show.config.audioOverride, loop };
    const config: SlideshowConfig = { ...show.config, audioOverride };
    updateSlideshow.mutate({ id: show.id, updates: { config } });
  };

  const togglePreview = (trackId: string) => {
    setPreviewTrackId((prev) => (prev === trackId ? null : trackId));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-spa-primary/10 flex items-center justify-center text-spa-primary">
          <Music className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-spa-text-primary">{title}</h3>
          {subtitle && <p className="text-sm text-spa-text-secondary">{subtitle}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left: Audio-Bibliothek (2/5) ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-spa-surface rounded-xl shadow-xs border border-spa-border overflow-hidden">
            <div className="p-4 border-b border-spa-border">
              <h4 className="text-sm font-semibold text-spa-text-primary">Audio-Bibliothek</h4>
              <p className="text-xs text-spa-text-secondary mt-0.5">Verfügbare Tracks</p>
            </div>

            <div className="divide-y divide-spa-border">
              {audioItems.length === 0 ? (
                <p className="text-sm text-spa-text-secondary p-4 text-center">
                  Keine Audio-Dateien vorhanden.
                </p>
              ) : (
                audioItems.map((item) => {
                  const isPlaying = previewTrackId === item.id;
                  const previewUrl = toAbsoluteMediaUrl(toRelativeUploadPath(item.filename));
                  return (
                    <div key={item.id} className="p-3 flex items-center gap-3">
                      <button
                        onClick={() => togglePreview(item.id)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isPlaying
                            ? 'bg-spa-primary text-white'
                            : 'bg-spa-bg-secondary text-spa-text-secondary hover:text-spa-primary'
                        }`}
                        aria-label={isPlaying ? 'Vorschau stoppen' : 'Vorschau abspielen'}
                      >
                        {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-spa-text-primary truncate">{item.originalName}</p>
                        <p className="text-[10px] text-spa-text-secondary">{(item.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      {isPlaying && (
                        <audio
                          autoPlay
                          src={previewUrl}
                          onEnded={() => setPreviewTrackId(null)}
                          className="hidden"
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Upload */}
            <div className="p-4 border-t border-spa-border">
              <label className="flex items-center justify-center gap-2 w-full py-3 bg-spa-bg-secondary text-spa-text-secondary text-sm font-semibold rounded-lg hover:bg-spa-bg-primary transition-colors cursor-pointer border border-dashed border-spa-border">
                {uploadMedia.isPending ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" />Upload läuft…</>
                ) : (
                  <><Upload className="w-4 h-4" />Neue Datei hochladen</>
                )}
                <input
                  type="file"
                  accept="audio/*"
                  aria-label="Audio-Datei hochladen"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    uploadMedia.mutate(file);
                  }}
                />
              </label>
              <p className="text-xs text-spa-text-secondary text-center mt-1.5">MP3, WAV, OGG, WebM · max. 50 MB</p>
            </div>
          </div>
        </div>

        {/* ── Right: Audio pro Slideshow (3/5) ── */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-spa-surface rounded-xl shadow-xs border border-spa-border overflow-hidden">
            <div className="p-4 border-b border-spa-border">
              <h4 className="text-sm font-semibold text-spa-text-primary">Audio pro Slideshow</h4>
              <p className="text-xs text-spa-text-secondary mt-0.5">Wählen Sie für jede Slideshow einen Track aus</p>
            </div>

            <div className="divide-y divide-spa-border">
              {slideshows.length === 0 ? (
                <p className="text-sm text-spa-text-secondary p-4 text-center">
                  Keine Slideshows vorhanden.
                </p>
              ) : (
                slideshows.map((show: SlideshowDefinition) => {
                  const override = show.config.audioOverride;
                  const currentMedia = override?.mediaId ? getMediaById(override.mediaId) : null;
                  const vol = override ? Math.round(clampVolume(override.volume) * 100) : 50;

                  return (
                    <div key={show.id} className="p-4 space-y-3">
                      {/* Slideshow name */}
                      <div className="flex items-center gap-2">
                        <Presentation className="w-4 h-4 text-spa-primary shrink-0" />
                        <span className="text-sm font-semibold text-spa-text-primary truncate">
                          {show.name}
                          {show.isDefault && <span className="ml-1.5 text-xs text-spa-primary font-normal">(Standard)</span>}
                        </span>
                        {show.assignedDevices && show.assignedDevices.length > 0 && (
                          <span className="ml-auto text-[10px] text-spa-text-secondary shrink-0">
                            {show.assignedDevices.length} Gerät{show.assignedDevices.length !== 1 ? 'e' : ''}
                          </span>
                        )}
                      </div>

                      {/* Track selection */}
                      <select
                        value={override?.mediaId || ''}
                        onChange={(e) => handleSlideshowAudioChange(show, e.target.value || undefined)}
                        className="w-full px-3 py-2 border border-spa-border rounded-lg text-sm bg-spa-surface text-spa-text-primary focus:ring-2 focus:ring-spa-primary/20 focus:border-spa-primary outline-hidden"
                      >
                        <option value="">Kein Audio</option>
                        {audioItems.map((item) => (
                          <option key={item.id} value={item.id}>{item.originalName}</option>
                        ))}
                      </select>

                      {/* Volume + Loop (only when audio is assigned) */}
                      {override?.enabled && currentMedia && (
                        <div className="flex items-center gap-4 pl-1">
                          <div className="flex items-center gap-2 flex-1">
                            <Volume2 className="w-3.5 h-3.5 text-spa-text-secondary shrink-0" />
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={clampVolume(override.volume)}
                              onChange={(e) => handleSlideshowVolumeChange(show, parseFloat(e.target.value))}
                              className="w-full h-1 bg-spa-bg-secondary rounded-lg appearance-none cursor-pointer accent-spa-primary"
                              aria-label="Lautstärke"
                            />
                            <span className="text-[10px] text-spa-text-secondary w-8 text-right">{vol}%</span>
                          </div>
                          <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={override.loop}
                              onChange={(e) => handleSlideshowLoopChange(show, e.target.checked)}
                              className="w-3.5 h-3.5 rounded border-spa-border text-spa-primary focus:ring-spa-primary/20"
                            />
                            <span className="text-xs text-spa-text-secondary">Loop</span>
                          </label>
                        </div>
                      )}

                      {/* Assigned devices */}
                      {show.assignedDevices && show.assignedDevices.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {show.assignedDevices.slice(0, 5).map((d) => (
                            <span key={d.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-spa-bg-secondary text-spa-text-secondary">
                              {d.name}
                            </span>
                          ))}
                          {show.assignedDevices.length > 5 && (
                            <span className="text-[10px] text-spa-text-secondary px-1">+{show.assignedDevices.length - 5}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Sync-Hinweis */}
          <div className="p-3 rounded-lg bg-spa-info-light border border-spa-info/20 text-spa-info-dark">
            <p className="text-xs leading-relaxed">
              Audio-Änderungen werden beim nächsten Gerät-Sync wirksam (ca. 2–5 Minuten). Audio wird nur auf den Display-Geräten abgespielt, nicht in der Admin-Oberfläche.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
