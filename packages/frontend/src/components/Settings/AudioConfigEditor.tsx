import { useMemo } from 'react';
import { Music, Upload, Volume2, VolumeX } from 'lucide-react';
import { useMedia, useUploadMedia } from '@/hooks/useMedia';
import type { AudioSettings } from '@/types/settings.types';
import type { Media } from '@/types/media.types';
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

function normalizeAudio(value: AudioSettings): AudioSettings {
  return {
    enabled: Boolean(value.enabled),
    src: value.src,
    mediaId: value.mediaId,
    volume: clampVolume(value.volume ?? 0.5),
    loop: value.loop !== false,
  };
}

export function AudioConfigEditor({
  audio,
  onChange,
  title = 'Hintergrundmusik',
  subtitle = 'Musik waehrend der Slideshow abspielen',
  showEnableToggle = true,
  enableLabel = 'Hintergrundmusik aktivieren',
  enableDescription = 'Musik waehrend der Slideshow abspielen',
}: AudioConfigEditorProps) {
  const normalized = normalizeAudio(audio);
  const { data: media } = useMedia({ type: 'audio' });
  const uploadMedia = useUploadMedia();

  const audioItems = useMemo(
    () => (media || []).filter((item: Media) => item.type === 'audio'),
    [media]
  );

  const selectedMedia = useMemo(
    () => audioItems.find((item) => item.id === normalized.mediaId),
    [audioItems, normalized.mediaId]
  );

  const updateAudio = (patch: Partial<AudioSettings>) => {
    onChange(normalizeAudio({ ...normalized, ...patch }));
  };

  const setAudioFromMedia = (item?: Media) => {
    if (!item) {
      updateAudio({ mediaId: undefined, src: undefined });
      return;
    }

    updateAudio({
      enabled: true,
      mediaId: item.id,
      src: toRelativeUploadPath(item.filename),
    });
  };

  const previewSrc = normalized.src ? toAbsoluteMediaUrl(normalized.src) : '';
  const isEnabled = showEnableToggle ? normalized.enabled : true;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Music className="w-5 h-5 text-spa-primary" />
        <div>
          <h3 className="text-lg font-semibold text-spa-text-primary">{title}</h3>
          {subtitle && <p className="text-sm text-spa-text-secondary">{subtitle}</p>}
        </div>
      </div>

      {showEnableToggle && (
        <div className="flex items-center justify-between p-4 bg-spa-bg-secondary rounded-lg">
          <div>
            <div className="font-medium text-spa-text-primary">{enableLabel}</div>
            <div className="text-sm text-spa-text-secondary">{enableDescription}</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={normalized.enabled}
              onChange={(e) => updateAudio({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-spa-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-spa-accent"></div>
          </label>
        </div>
      )}

      {isEnabled && (
        <>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-spa-text-primary">
              Audio aus Mediathek
            </label>
            {audioItems.length === 0 ? (
              <div className="text-sm text-spa-text-secondary bg-spa-bg-secondary rounded-md p-3">
                Keine Audio-Dateien vorhanden. Lade unten eine Datei hoch.
              </div>
            ) : (
              <select
                value={normalized.mediaId || ''}
                onChange={(e) => {
                  const mediaId = e.target.value || undefined;
                  const item = audioItems.find((m) => m.id === mediaId);
                  setAudioFromMedia(item);
                }}
                className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
              >
                <option value="">Keine Musik</option>
                {audioItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.originalName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="p-4 border-2 border-dashed border-spa-secondary/30 rounded-lg">
            <div className="text-center">
              <Upload className="w-10 h-10 mx-auto text-spa-secondary mb-2" />
              <div className="text-sm text-spa-text-primary mb-2">Neue Audio-Datei hochladen</div>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  uploadMedia.mutate(file, {
                    onSuccess: (uploaded) => {
                      setAudioFromMedia(uploaded);
                    },
                  });
                }}
                className="block mx-auto text-sm text-spa-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-spa-primary file:text-white hover:file:bg-spa-primary-dark cursor-pointer"
              />
              <div className="text-xs text-spa-text-secondary mt-2">
                MP3, WAV, OGG, WebM (max. 50MB)
              </div>
              {uploadMedia.isPending && (
                <div className="text-xs text-spa-primary mt-2">Upload laeuft...</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-spa-text-primary flex items-center gap-2">
                {normalized.volume > 0 ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
                Lautstaerke
              </label>
              <span className="text-sm font-mono text-spa-text-secondary">
                {Math.round(clampVolume(normalized.volume) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={clampVolume(normalized.volume)}
              onChange={(e) => updateAudio({ volume: parseFloat(e.target.value) })}
              className="w-full h-2 bg-spa-bg-secondary rounded-lg appearance-none cursor-pointer accent-spa-primary"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-spa-bg-secondary rounded-lg">
            <div>
              <div className="font-medium text-spa-text-primary">Wiederholen</div>
              <div className="text-sm text-spa-text-secondary">Musik in Endlosschleife abspielen</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={normalized.loop}
                onChange={(e) => updateAudio({ loop: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-spa-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-spa-accent"></div>
            </label>
          </div>

          {previewSrc && (
            <div className="p-4 bg-spa-bg-secondary rounded-lg">
              <div className="text-sm font-medium text-spa-text-primary mb-2">Audio-Vorschau</div>
              <audio
                controls
                src={previewSrc}
                className="w-full"
                loop={normalized.loop}
              />
              {selectedMedia && (
                <div className="text-xs text-spa-text-secondary mt-2">
                  Ausgewaehlt: {selectedMedia.originalName}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

