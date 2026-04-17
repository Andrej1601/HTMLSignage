import { lazy, Suspense, useEffect, useState } from 'react';
import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { getDefaultSettings } from '@/types/settings.types';
import type { Sauna } from '@/types/sauna.types';
import type { Media } from '@/types/media.types';
import type { SlideConfig } from '@/types/slideshow.types';
import { Flame } from 'lucide-react';
import { ResilientImage } from './ResilientImage';
import {
  isModernDisplayDesignStyle,
  loadSaunaDetailDashboard,
} from './displayDynamicModules';
import { useSaunaDetailData } from '@/slides/data';

const LazySaunaDetailDashboard = lazy(loadSaunaDetailDashboard);

interface DisplaySaunaDetailSlideProps {
  /** Legacy prop — used as a hint only; data is re-resolved via the hook. */
  sauna?: Sauna;
  saunaId?: string;
  slide?: SlideConfig;
  schedule: Schedule;
  settings: Settings;
  media?: Media[];
  deviceId?: string;
}

function SaunaDetailFallback({ settings }: { settings: Settings }) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;

  return (
    <div
      className="w-full h-full"
      style={{ backgroundColor: theme.dashboardBg || theme.bg }}
      aria-hidden="true"
    />
  );
}

export function DisplaySaunaDetailSlide({
  sauna,
  saunaId,
  slide,
  schedule,
  settings,
  media,
  deviceId,
}: DisplaySaunaDetailSlideProps) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;
  const fonts = settings.fonts || defaults.fonts!;
  const designStyle = settings.designStyle || 'modern-wellness';
  const resolvedSaunaId = saunaId || slide?.saunaId || sauna?.id;

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const data = useSaunaDetailData({
    settings,
    schedule,
    saunaId: resolvedSaunaId,
    media,
    deviceId,
    now,
  });

  if (isModernDisplayDesignStyle(designStyle)) {
    return (
      <Suspense fallback={<SaunaDetailFallback settings={settings} />}>
        <LazySaunaDetailDashboard
          schedule={schedule}
          settings={settings}
          saunaId={resolvedSaunaId}
          media={media}
          deviceId={deviceId}
        />
      </Suspense>
    );
  }

  if (!data) {
    return (
      <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">
        {resolvedSaunaId ? 'Sauna nicht gefunden' : 'Keine Sauna ausgewählt'}
      </div>
    );
  }

  const imageUrl = data.imageUrl;

  return (
    <div
      className="w-full h-screen flex items-center justify-center p-16 relative overflow-hidden"
      style={{ backgroundColor: theme.bg }}
    >
      {imageUrl ? (
        <>
          <ResilientImage
            src={imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            fallback={<div className="absolute inset-0" style={{ backgroundColor: theme.bg }} />}
          />
          <div className="absolute inset-0 bg-black/45" />
        </>
      ) : null}
      <div className="max-w-6xl w-full relative">
        <div
          className="rounded-3xl p-12 shadow-2xl backdrop-blur-xs"
          style={{
            backgroundColor: imageUrl ? 'rgba(255, 255, 255, 0.95)' : theme.cellBg,
            borderLeft: `12px solid ${data.accentColor || theme.accent}`,
          }}
        >
          <h1
            className="font-bold mb-6"
            style={{
              fontSize: `${(fonts.h1Scale || 1.5) * 3}rem`,
              color: data.accentColor || theme.fg,
            }}
          >
            {slide?.title || data.name}
          </h1>

          {(data.description ?? "") ? (
            <p
              className="mb-8"
              style={{
                fontSize: `${(fonts.fontScale || 1) * 1.5}rem`,
                color: theme.fg,
                opacity: 0.8,
              }}
            >
              {(data.description ?? "")}
            </p>
          ) : null}

          <div className="grid grid-cols-3 gap-8 mb-8">
            {data.info.temperatureC ? (
              <div
                className="text-center p-6 rounded-2xl"
                style={{
                  backgroundColor: `${data.accentColor || theme.accent}20`,
                }}
              >
                <div
                  className="font-bold"
                  style={{
                    fontSize: `${(fonts.fontScale || 1) * 4}rem`,
                    color: data.accentColor || theme.fg,
                  }}
                >
                  {data.info.temperatureC}°C
                </div>
                <div
                  style={{
                    fontSize: `${(fonts.fontScale || 1) * 1.2}rem`,
                    opacity: 0.7,
                    marginTop: '0.5rem',
                  }}
                >
                  Temperatur
                </div>
              </div>
            ) : null}

            {data.info.humidityPct ? (
              <div
                className="text-center p-6 rounded-2xl"
                style={{
                  backgroundColor: `${data.accentColor || theme.accent}20`,
                }}
              >
                <div
                  className="font-bold"
                  style={{
                    fontSize: `${(fonts.fontScale || 1) * 4}rem`,
                    color: data.accentColor || theme.fg,
                  }}
                >
                  {data.info.humidityPct}%
                </div>
                <div
                  style={{
                    fontSize: `${(fonts.fontScale || 1) * 1.2}rem`,
                    opacity: 0.7,
                    marginTop: '0.5rem',
                  }}
                >
                  Luftfeuchtigkeit
                </div>
              </div>
            ) : null}

            {data.info.capacity ? (
              <div
                className="text-center p-6 rounded-2xl"
                style={{
                  backgroundColor: `${data.accentColor || theme.accent}20`,
                }}
              >
                <div
                  className="font-bold"
                  style={{
                    fontSize: `${(fonts.fontScale || 1) * 4}rem`,
                    color: data.accentColor || theme.fg,
                  }}
                >
                  {data.info.capacity}
                </div>
                <div
                  style={{
                    fontSize: `${(fonts.fontScale || 1) * 1.2}rem`,
                    opacity: 0.7,
                    marginTop: '0.5rem',
                  }}
                >
                  Personen
                </div>
              </div>
            ) : null}
          </div>

          {data.info.features && data.info.features.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {data.info.features.map((feature, index) => (
                <span
                  key={index}
                  className="px-6 py-3 rounded-full font-semibold"
                  style={{
                    backgroundColor: data.accentColor || theme.flame,
                    color: '#FFFFFF',
                    fontSize: `${(fonts.badgeTextScale || 0.85) * 1.5}rem`,
                  }}
                >
                  {feature}
                </span>
              ))}
            </div>
          ) : null}

          {data.info.temperatureC ? (
            <div className="flex items-center justify-center gap-2 mt-8">
              {Array.from({
                length: Math.min(4, Math.floor(data.info.temperatureC / 25)),
              }).map((_, index) => (
                <Flame
                  key={index}
                  className="w-12 h-12"
                  style={{ color: theme.flame }}
                  fill={theme.flame}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
