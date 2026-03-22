import { SectionCard } from '@/components/SectionCard';
import { AudioConfigEditor } from '@/components/Settings/AudioConfigEditor';
import type { AudioSettings } from '@/types/settings.types';

interface AudioOverrideSectionProps {
  audioOverride: AudioSettings | null;
  onAudioOverrideChange: (audio: AudioSettings | null) => void;
  disabled?: boolean;
  title?: string;
  subtitle?: string;
  enableLabel?: string;
  enableDescription?: string;
}

const DEFAULT_AUDIO_OVERRIDE: AudioSettings = {
  enabled: false,
  volume: 0.5,
  loop: true,
};

export function AudioOverrideSection({
  audioOverride,
  onAudioOverrideChange,
  disabled = false,
  title = 'Audio-Override',
  subtitle = 'Musik für diese Slideshow-Ausgabe konfigurieren.',
  enableLabel = 'Audio-Override aktivieren',
  enableDescription = 'Wird für diesen Zielkontext verwendet.',
}: AudioOverrideSectionProps) {
  return (
    <SectionCard
      title={title}
      description={subtitle}
      actions={
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(audioOverride)}
            onChange={(event) => {
              if (event.target.checked) {
                onAudioOverrideChange(audioOverride || { ...DEFAULT_AUDIO_OVERRIDE });
              } else {
                onAudioOverrideChange(null);
              }
            }}
            className="sr-only peer"
            disabled={disabled}
            aria-label={title}
          />
          <div className="w-11 h-6 bg-spa-bg-secondary peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-spa-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-spa-accent" />
        </label>
      }
    >
      {audioOverride ? (
        <AudioConfigEditor
          audio={audioOverride}
          onChange={onAudioOverrideChange}
          title={title}
          subtitle={subtitle}
          showEnableToggle
          enableLabel={enableLabel}
          enableDescription={enableDescription}
        />
      ) : (
        <p className="text-sm text-spa-text-secondary">
          Kein Audio-Override aktiv.
        </p>
      )}
    </SectionCard>
  );
}
