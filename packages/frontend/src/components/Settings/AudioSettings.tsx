import type { AudioSettings } from '@/types/settings.types';
import { Music, Volume2, VolumeX, Upload } from 'lucide-react';

interface AudioSettingsProps {
  audio: AudioSettings;
  onChange: (audio: AudioSettings) => void;
}

export function AudioSettings({ audio, onChange }: AudioSettingsProps) {
  const updateAudio = (key: keyof AudioSettings, value: any) => {
    onChange({ ...audio, [key]: value });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Music className="w-5 h-5 text-spa-primary" />
        <h3 className="text-lg font-semibold text-spa-text-primary">Hintergrundmusik</h3>
      </div>

      {/* Enable/Disable */}
      <div className="flex items-center justify-between p-4 bg-spa-bg-secondary rounded-lg">
        <div>
          <div className="font-medium text-spa-text-primary">Hintergrundmusik aktivieren</div>
          <div className="text-sm text-spa-text-secondary">Musik während der Slideshow abspielen</div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={audio.enabled}
            onChange={(e) => updateAudio('enabled', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-spa-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-spa-accent"></div>
        </label>
      </div>

      {audio.enabled && (
        <>
          {/* File Upload */}
          <div className="p-4 border-2 border-dashed border-spa-secondary/30 rounded-lg">
            <div className="text-center">
              <Upload className="w-10 h-10 mx-auto text-spa-secondary mb-2" />
              <div className="text-sm text-spa-text-primary mb-2">
                {audio.src ? 'Datei hochgeladen' : 'Audio-Datei hochladen'}
              </div>
              {audio.src && (
                <div className="text-xs text-spa-text-secondary mb-3 font-mono">
                  {audio.src}
                </div>
              )}
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // TODO: Implement file upload
                    console.log('File selected:', file);
                    updateAudio('src', `/assets/media/audio/${file.name}`);
                  }
                }}
                className="block mx-auto text-sm text-spa-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-spa-primary file:text-white hover:file:bg-spa-primary-dark cursor-pointer"
              />
              <div className="text-xs text-spa-text-secondary mt-2">
                MP3, WAV, OGG (max. 10MB)
              </div>
            </div>
          </div>

          {/* Volume Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-spa-text-primary flex items-center gap-2">
                {audio.volume > 0 ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
                Lautstärke
              </label>
              <span className="text-sm font-mono text-spa-text-secondary">
                {Math.round(audio.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audio.volume}
              onChange={(e) => updateAudio('volume', parseFloat(e.target.value))}
              className="w-full h-2 bg-spa-bg-secondary rounded-lg appearance-none cursor-pointer accent-spa-primary"
            />
            <div className="flex justify-between text-xs text-spa-text-secondary">
              <span>Leise (0%)</span>
              <span>Laut (100%)</span>
            </div>
          </div>

          {/* Loop */}
          <div className="flex items-center justify-between p-4 bg-spa-bg-secondary rounded-lg">
            <div>
              <div className="font-medium text-spa-text-primary">Wiederholen</div>
              <div className="text-sm text-spa-text-secondary">Musik in Endlosschleife abspielen</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={audio.loop}
                onChange={(e) => updateAudio('loop', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-spa-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-spa-accent"></div>
            </label>
          </div>

          {/* Audio Player Preview */}
          {audio.src && (
            <div className="p-4 bg-spa-bg-secondary rounded-lg">
              <div className="text-sm font-medium text-spa-text-primary mb-2">Vorschau</div>
              <audio
                controls
                src={audio.src}
                className="w-full"
                loop={audio.loop}
              />
              <div className="text-xs text-spa-text-secondary mt-2">
                Hinweis: Die tatsächliche Lautstärke wird in der Slideshow angewendet.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
