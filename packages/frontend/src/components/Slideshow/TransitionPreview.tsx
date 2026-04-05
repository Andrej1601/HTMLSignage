import { useEffect, useState } from 'react';
import clsx from 'clsx';

interface TransitionPreviewProps {
  transition: string;
}

const TRANSITION_STYLES: Record<string, { from: string; to: string }> = {
  fade: {
    from: 'opacity-0',
    to: 'opacity-100',
  },
  slide: {
    from: 'translate-x-full opacity-0',
    to: 'translate-x-0 opacity-100',
  },
  zoom: {
    from: 'scale-50 opacity-0',
    to: 'scale-100 opacity-100',
  },
  none: {
    from: 'opacity-100',
    to: 'opacity-100',
  },
};

export function TransitionPreview({ transition }: TransitionPreviewProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(false);
    const timer = setTimeout(() => setActive(true), 50);
    return () => clearTimeout(timer);
  }, [transition]);

  // Replay on click
  const replay = () => {
    setActive(false);
    setTimeout(() => setActive(true), 50);
  };

  const styles = TRANSITION_STYLES[transition] || TRANSITION_STYLES.fade;

  if (transition === 'none') return null;

  return (
    <button
      type="button"
      onClick={replay}
      className="mt-2 w-full h-16 rounded-lg border border-spa-bg-secondary bg-spa-bg-primary overflow-hidden relative cursor-pointer group"
      title="Klicken zum Wiederholen"
      aria-label={`Vorschau: ${transition}-Übergang`}
    >
      <div className="absolute inset-0 flex items-center justify-center text-[10px] text-spa-text-secondary/50 uppercase tracking-wider">
        Vorher
      </div>
      <div
        className={clsx(
          'absolute inset-0 bg-spa-primary/15 flex items-center justify-center text-xs font-medium text-spa-primary transition-all duration-700 ease-out',
          active ? styles.to : styles.from
        )}
      >
        Nachher
      </div>
      <span className="absolute bottom-1 right-2 text-[9px] text-spa-text-secondary/40 opacity-0 group-hover:opacity-100 transition-opacity">
        Klicken = Wiederholen
      </span>
    </button>
  );
}
