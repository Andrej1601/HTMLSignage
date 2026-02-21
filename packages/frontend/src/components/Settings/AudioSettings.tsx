import type { AudioSettings } from '@/types/settings.types';
import { AudioConfigEditor } from './AudioConfigEditor';

interface AudioSettingsProps {
  audio: AudioSettings;
  onChange: (audio: AudioSettings) => void;
}

export function AudioSettings({ audio, onChange }: AudioSettingsProps) {
  return (
    <AudioConfigEditor
      audio={audio}
      onChange={onChange}
      title="Hintergrundmusik"
      subtitle="Musik während der Slideshow abspielen"
      showEnableToggle
      enableLabel="Hintergrundmusik aktivieren"
      enableDescription="Musik während der Slideshow abspielen"
    />
  );
}
