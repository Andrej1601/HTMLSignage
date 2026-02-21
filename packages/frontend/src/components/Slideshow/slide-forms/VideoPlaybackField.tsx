import type { VideoPlaybackMode } from '@/types/slideshow.types';
import { Clock, Film } from 'lucide-react';
import clsx from 'clsx';

interface VideoPlaybackFieldProps {
  value?: VideoPlaybackMode;
  onChange: (mode: VideoPlaybackMode) => void;
}

const MODES: { mode: VideoPlaybackMode; label: string; description: string; icon: typeof Clock }[] = [
  { mode: 'duration', label: 'Feste Dauer', description: 'Loop bei Bedarf', icon: Clock },
  { mode: 'complete', label: 'Bis Ende', description: 'Spielt bis zum Ende', icon: Film },
  { mode: 'loop-duration', label: 'Loop', description: 'Loop für Dauer', icon: Film },
];

export function VideoPlaybackField({ value, onChange }: VideoPlaybackFieldProps) {
  const active = value || 'duration';

  return (
    <div>
      <label className="block text-sm font-medium text-spa-text-primary mb-2">
        Video-Wiedergabe
      </label>
      <div className="grid grid-cols-3 gap-2">
        {MODES.map(({ mode, label, description, icon: Icon }) => (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className={clsx(
              'p-3 rounded-lg border-2 transition-all',
              active === mode
                ? 'border-spa-primary bg-spa-primary/5'
                : 'border-spa-bg-secondary hover:border-spa-primary/50'
            )}
          >
            <Icon className="w-5 h-5 mx-auto mb-1" />
            <div className="text-xs font-semibold">{label}</div>
            <div className="text-xs text-spa-text-secondary mt-1">{description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
