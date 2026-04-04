import { useMemo } from 'react';
import { Music, Upload, Volume2, VolumeX, RefreshCw } from 'lucide-react';
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
  subtitle = 'Musik während der Slideshow abspielen',
  showEnableToggle = true,
  enableLabel = 'Hintergrundmusik aktivieren',
  enableDescription: _enableDescription = 'Musik während der Slideshow abspielen',
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
    updateAudio({ enabled: true, mediaId: item.id, src: toRelativeUploadPath(item.filename) });
  };

  const previewSrc = normalized.src ? toAbsoluteMediaUrl(normalized.src) : '';
  const isEnabled = showEnableToggle ? normalized.enabled : true;
  const volumePct = Math.round(clampVolume(normalized.volume) * 100);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 tracking-tight">{title}</h2>
          {subtitle && <p className="text-stone-500 mt-1 text-sm">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          System Online
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Hintergrundmusik */}
        <div className="bg-white rounded-xl shadow-xs border border-stone-200 overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-stone-50 flex items-center justify-center text-[#8B6F47]">
                <Music className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-stone-800">Hintergrundmusik</h3>
            </div>
            {showEnableToggle && (
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={normalized.enabled}
                  onChange={(e) => updateAudio({ enabled: e.target.checked })}
                  className="sr-only peer"
                  aria-label={enableLabel}
                />
                <div className="w-11 h-6 bg-stone-200 rounded-full peer peer-checked:bg-[#8B6F47] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-stone-300 after:rounded-full after:h-5 after:w-5 after:transition-all" />
              </label>
            )}
          </div>

          <div className="p-6 space-y-6">
            {/* Volume */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-widest text-stone-500">
                  Lautstärke
                </label>
                <span className="text-sm font-bold text-[#8B6F47]">{volumePct}%</span>
              </div>
              <div className="flex items-center gap-3">
                <VolumeX className="w-4 h-4 text-stone-400 shrink-0" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={clampVolume(normalized.volume)}
                  onChange={(e) => updateAudio({ volume: parseFloat(e.target.value) })}
                  aria-label={`Lautstärke: ${volumePct}%`}
                  className="w-full h-1.5 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-[#8B6F47]"
                />
                <Volume2 className="w-4 h-4 text-stone-400 shrink-0" />
              </div>
            </div>

            {/* Audio aus Mediathek */}
            {isEnabled && (
              <>
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500">
                    Quelle — Mediathek
                  </label>
                  {audioItems.length === 0 ? (
                    <div className="text-sm text-stone-400 bg-stone-50 rounded-lg p-3 border border-stone-100">
                      Keine Audio-Dateien vorhanden.
                    </div>
                  ) : (
                    <select
                      value={normalized.mediaId || ''}
                      onChange={(e) => {
                        const mediaId = e.target.value || undefined;
                        setAudioFromMedia(audioItems.find((m) => m.id === mediaId));
                      }}
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-[#8B6F47]/20 focus:border-[#8B6F47] outline-hidden bg-stone-50"
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

                {/* Upload */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Datei hochladen
                  </label>
                  <label className="flex items-center justify-center gap-2 w-full py-3 bg-stone-100 text-stone-600 text-sm font-semibold rounded-lg hover:bg-stone-200 transition-colors cursor-pointer">
                    {uploadMedia.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Upload läuft…
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Datei auswählen
                      </>
                    )}
                    <input
                      type="file"
                      accept="audio/*"
                      aria-label="Audio-Datei hochladen"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        uploadMedia.mutate(file, { onSuccess: (uploaded) => setAudioFromMedia(uploaded) });
                      }}
                    />
                  </label>
                  <p className="text-xs text-stone-400 text-center mt-1.5">MP3, WAV, OGG, WebM · max. 50 MB</p>
                </div>

                {/* Preview */}
                {previewSrc && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-stone-500">
                      Vorschau
                    </label>
                    <audio controls src={previewSrc} className="w-full" loop={normalized.loop} />
                    {selectedMedia && (
                      <p className="text-xs text-stone-400 truncate">{selectedMedia.originalName}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Card: Wiedergabe-Einstellungen */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-xs border border-stone-200 overflow-hidden">
            <div className="p-5 border-b border-stone-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-stone-50 flex items-center justify-center text-[#8B6F47]">
                <RefreshCw className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-stone-800">Wiedergabe-Einstellungen</h3>
            </div>

            <div className="p-6 space-y-6">
              {/* Loop toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-700">Wiederholen</p>
                  <p className="text-xs text-stone-400 mt-0.5">Musik in Endlosschleife abspielen</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={normalized.loop}
                    onChange={(e) => updateAudio({ loop: e.target.checked })}
                    className="sr-only peer"
                    aria-label="Wiederholen"
                  />
                  <div className="w-9 h-5 bg-stone-200 rounded-full peer peer-checked:bg-[#7FA99B] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-stone-300 after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
              </div>

              <div className="pt-2 border-t border-stone-100">
                <p className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-3">
                  Hinweis
                </p>
                <div className="flex gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-800">
                  <span className="text-lg shrink-0">ℹ️</span>
                  <p className="text-xs leading-relaxed">
                    Änderungen werden beim nächsten Gerät-Sync wirksam. Die durchschnittliche Synchronisationszeit beträgt ca. 5 Minuten.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* System Status Card */}
          <div className="bg-stone-900 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#8B6F47]/20 blur-3xl -mr-12 -mt-12 rounded-full pointer-events-none" />
            <div className="relative z-10 flex items-start justify-between">
              <div className="space-y-3">
                <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-xs text-xl">
                  🎵
                </div>
                <div>
                  <h4 className="text-white font-bold">System-Status</h4>
                  <p className="text-stone-400 text-xs mt-1 max-w-[180px] leading-relaxed">
                    Audio-Ausgabe aktiv auf verbundenen Endgeräten.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[#8B6F47] font-mono text-2xl font-bold">{volumePct}%</p>
                <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mt-1">Lautstärke</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
