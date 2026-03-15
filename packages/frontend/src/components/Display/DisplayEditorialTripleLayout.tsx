import { useEffect, useState } from 'react';
import { WellnessBottomPanel } from '@/components/Display/WellnessBottomPanel';
import type {
  DisplayLayoutContext,
  TripleZoneStateMap,
} from '@/components/Display/displayLayoutRenderer.types';
import {
  renderTriplePaddedSlide,
  renderTripleSaunaDetail,
  renderTripleSlideRenderer,
} from '@/components/Display/displayTripleLayoutUtils';
import {
  DisplayEditorialPanel,
  DisplayEditorialStage,
  getEditorialStageMeta,
} from '@/components/Display/displayEditorialChrome';
import { classNames } from '@/utils/classNames';

interface DisplayEditorialTripleLayoutProps {
  context: DisplayLayoutContext;
  zoneStates: TripleZoneStateMap;
}

interface AnimatedProgressBarProps {
  durationSec: number;
  endColor: string;
  startColor: string;
}

function AnimatedProgressBar({
  durationSec,
  endColor,
  startColor,
}: AnimatedProgressBarProps) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsActive(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      className="h-full origin-left"
      style={{
        background: `linear-gradient(to right, ${startColor}, ${endColor})`,
        transform: isActive ? 'scaleX(1)' : 'scaleX(0)',
        transition: `transform ${durationSec}s linear`,
        willChange: 'transform',
      }}
    />
  );
}

function getPanelLabel(zoneState: TripleZoneStateMap['topRight']): string {
  const slide = zoneState.slide;

  if (!slide) return 'Spotlight';
  if (slide.type === 'sauna-detail') return 'Sauna Fokus';
  if (slide.type === 'infos') return 'Hinweise';
  if (slide.type === 'events') return 'Events';
  if (slide.type === 'content-panel') return 'Programm';
  if (slide.type.startsWith('media-')) return 'Bühnenmoment';
  return slide.title?.trim() || 'Spotlight';
}

export function DisplayEditorialTripleLayout({
  context,
  zoneStates,
}: DisplayEditorialTripleLayoutProps) {
  const {
    currentTime,
    displayAppearance,
    effectiveSettings,
    renderContentPanel,
    themeColors,
    mediaItems,
  } = context;
  const { left, topRight, bottomRight } = zoneStates;
  const stageMeta = getEditorialStageMeta(effectiveSettings, currentTime);

  const leftSize = left.zone?.size || 60;
  const rightSize = 100 - leftSize;
  const topDurationSec = topRight.slide?.duration ?? 12;
  const accentWarm = themeColors.accentGold || themeColors.accent || '#A68A64';
  const accentCool = themeColors.accentGreen || themeColors.timeColBg || '#8F9779';

  const renderLeftPanel = () => {
    if (!left.slide || left.slide.type === 'content-panel') {
      return renderContentPanel();
    }

    if (left.slide.type.startsWith('media-')) {
      return renderTriplePaddedSlide(context, left.slide, left.zone?.id, {
        outerClassName: 'p-5 w-full h-full',
        innerClassName: 'w-full h-full rounded-[2rem] overflow-hidden border-[4px] border-white/80 shadow-xl',
      });
    }

    return renderTripleSlideRenderer(context, left.slide, left.zone?.id);
  };

  const renderTopRightPanel = () => {
    if (topRight.slide?.type === 'sauna-detail') {
      return renderTripleSaunaDetail(context, topRight.slide.saunaId);
    }

    if (topRight.slide) {
      if (topRight.slide.type.startsWith('media-')) {
        return renderTriplePaddedSlide(context, topRight.slide, topRight.zone?.id, {
          outerClassName: 'p-5 w-full h-full',
          innerClassName: 'w-full h-full rounded-[1.9rem] overflow-hidden border-[4px] border-white/80 shadow-xl',
        });
      }

      return (
        <div className="h-full w-full">
          {renderTripleSlideRenderer(context, topRight.slide, topRight.zone?.id)}
        </div>
      );
    }

    return renderTripleSaunaDetail(context, undefined);
  };

  const renderBottomRightPanel = () => {
    if (bottomRight.slide) {
      if (bottomRight.slide.type.startsWith('media-')) {
        return renderTriplePaddedSlide(context, bottomRight.slide, bottomRight.zone?.id, {
          outerClassName: 'p-4 w-full h-full',
          innerClassName: 'w-full h-full rounded-[1.75rem] overflow-hidden border-[4px] border-white/80 shadow-lg',
        });
      }

      return renderTripleSlideRenderer(context, bottomRight.slide, bottomRight.zone?.id);
    }

    return (
      <WellnessBottomPanel
        displayAppearance={displayAppearance}
        settings={effectiveSettings}
        theme={themeColors}
        media={mediaItems}
      />
    );
  };

  return (
    <DisplayEditorialStage
      theme={themeColors}
      subtitle={stageMeta.subtitle}
      title={stageMeta.title}
      meta={stageMeta.meta}
      contentClassName="h-[calc(100%-4.25rem)]"
    >
      <div className="flex h-full gap-5">
        <div style={{ width: `${leftSize}%` }}>
          <DisplayEditorialPanel
            theme={themeColors}
            label="Programm des Tages"
            meta={!left.slide || left.slide.type === 'content-panel' ? 'Live-Übersicht' : undefined}
            tone="paper"
          >
            {renderLeftPanel()}
          </DisplayEditorialPanel>
        </div>

        <div className="flex h-full flex-col gap-5" style={{ width: `${rightSize}%` }}>
          <div className="flex-1 min-h-0">
            <DisplayEditorialPanel
              theme={themeColors}
              label={getPanelLabel(topRight)}
              meta={topRight.info?.shouldRotate ? 'Rotation aktiv' : undefined}
              tone="glass"
            >
              {renderTopRightPanel()}
            </DisplayEditorialPanel>
          </div>

          <div className="h-56 shrink-0">
            <DisplayEditorialPanel
              theme={themeColors}
              label={bottomRight.slide ? getPanelLabel(bottomRight) : 'Hinweise & Service'}
              meta={bottomRight.slide ? undefined : 'Infos und Events'}
              tone="accent"
              contentClassName={classNames(!bottomRight.slide && 'px-6 pb-5')}
            >
              {renderBottomRightPanel()}
            </DisplayEditorialPanel>
          </div>
        </div>
      </div>

      {(topRight.info?.shouldRotate || false) && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 h-2 w-56 -translate-x-1/2 overflow-hidden rounded-full bg-black/10">
          <AnimatedProgressBar
            key={topRight.slide?.id || topRight.info?.currentSlideIndex || 0}
            durationSec={topDurationSec}
            startColor={accentCool}
            endColor={accentWarm}
          />
        </div>
      )}
    </DisplayEditorialStage>
  );
}
