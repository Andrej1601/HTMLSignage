import { useEffect, useState } from 'react';
import type { Settings } from '@/types/settings.types';

interface ClockSlideProps {
  settings: Settings;
}

export function ClockSlide({ settings }: ClockSlideProps) {
  const { theme, fonts } = settings;
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const seconds = time.getSeconds().toString().padStart(2, '0');
  const date = time.toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className="w-full h-screen flex flex-col items-center justify-center"
      style={{
        backgroundColor: theme.bg,
        color: theme.fg,
      }}
    >
      <div className="text-center">
        {/* Time */}
        <div
          style={{
            fontSize: `${fonts.fontScale * 8}rem`,
            fontWeight: fonts.tileTimeWeight,
            lineHeight: 1,
            color: theme.accent,
          }}
        >
          {hours}
          <span style={{ opacity: 0.5 }}>:</span>
          {minutes}
        </div>

        {/* Seconds */}
        <div
          style={{
            fontSize: `${fonts.fontScale * 3}rem`,
            fontWeight: 300,
            marginTop: '1rem',
            opacity: 0.7,
          }}
        >
          {seconds}
        </div>

        {/* Date */}
        <div
          style={{
            fontSize: `${fonts.fontScale * 1.5}rem`,
            marginTop: '3rem',
            opacity: 0.9,
            textTransform: 'capitalize',
          }}
        >
          {date}
        </div>
      </div>
    </div>
  );
}
