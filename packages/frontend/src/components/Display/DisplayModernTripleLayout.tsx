import { useEffect, useState } from 'react';
import { SlideTransition } from '@/components/Display/SlideTransition';
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
import { classNames } from '@/utils/classNames';
import { withAlpha } from '@/components/Display/wellnessDisplayUtils';

interface DisplayModernTripleLayoutProps {
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

export function DisplayModernTripleLayout({
  context,
  zoneStates,
}: DisplayModernTripleLayoutProps) {
  const {
    designStyle,
    effectiveSettings,
    enableTransitions,
    renderContentPanel,
    resolveTransition,
    showZoneBorders,
    themeColors,
    mediaItems,
  } = context;
  const { left, topRight, bottomRight } = zoneStates;

  const leftSize = left.zone?.size || (designStyle === 'modern-timeline' ? 65 : 60);
  const rightSize = 100 - leftSize;
  const topDurationSec = topRight.slide?.duration ?? 12;

  const leftBg = themeColors.zebra1 || '#F7F3E9';
  const rightBg = themeColors.zebra2 || '#F2EDE1';
  const border = themeColors.gridTable || '#EBE5D3';
  const bottomBg = withAlpha(rightBg, 0.6);

  const accentGreen = themeColors.accentGreen || themeColors.timeColBg || '#8F9779';
  const accentGold = themeColors.accentGold || themeColors.accent || '#A68A64';

  const renderLeftPanel = () => {
    if (!left.slide || left.slide.type === 'content-panel') {
      return renderContentPanel();
    }

    if (left.slide.type.startsWith('media-')) {
      return renderTriplePaddedSlide(context, left.slide, left.zone?.id, {
        outerClassName: 'p-5 w-full h-full',
        innerClassName: 'w-full h-full rounded-[2.5rem] overflow-hidden border-[6px] border-white shadow-xl',
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
          innerClassName: 'w-full h-full rounded-[2.3rem] overflow-hidden border-[6px] border-white shadow-xl',
        });
      }

      return <div className="w-full h-full">{renderTripleSlideRenderer(context, topRight.slide, topRight.zone?.id)}</div>;
    }

    return renderTripleSaunaDetail(context, undefined);
  };

  const renderBottomRightPanel = () => {
    if (bottomRight.slide) {
      if (bottomRight.slide.type.startsWith('media-')) {
        return renderTriplePaddedSlide(context, bottomRight.slide, bottomRight.zone?.id, {
          outerClassName: 'p-2 w-full h-full',
          innerClassName: 'w-full h-full rounded-[1.8rem] overflow-hidden border-4 border-white shadow-lg',
        });
      }

      return renderTripleSlideRenderer(context, bottomRight.slide, bottomRight.zone?.id);
    }

    return (
      <WellnessBottomPanel
        displayAppearance={context.displayAppearance}
        settings={effectiveSettings}
        theme={themeColors}
        media={mediaItems}
      />
    );
  };

  return (
    <div className="w-full h-full flex relative overflow-hidden">
      <div
        className={classNames('h-full relative overflow-hidden', showZoneBorders && 'border-r')}
        style={{
          width: `${leftSize}%`,
          backgroundColor: leftBg,
          borderColor: showZoneBorders ? border : undefined,
        }}
      >
        <SlideTransition
          slideKey={left.slide?.id || `content-panel-${designStyle}`}
          enabled={enableTransitions && (left.info?.shouldRotate || false)}
          duration={0.6}
          transition={resolveTransition(left.slide)}
        >
          {renderLeftPanel()}
        </SlideTransition>
      </div>

      <div
        className="h-full flex flex-col relative overflow-hidden"
        style={{
          width: `${rightSize}%`,
          backgroundColor: rightBg,
        }}
      >
        <div className="flex-1 relative overflow-hidden flex flex-col">
          <SlideTransition
            slideKey={topRight.slide?.id || topRight.info?.currentSlideIndex || 'top-fallback'}
            enabled={enableTransitions && (topRight.info?.shouldRotate || false)}
            duration={0.6}
            transition={resolveTransition(topRight.slide)}
          >
            <div className="absolute inset-0 flex flex-col">
              {renderTopRightPanel()}
            </div>
          </SlideTransition>
        </div>

        <div
          className={classNames('h-44 p-4 relative shrink-0 overflow-hidden', showZoneBorders && 'border-t')}
          style={{
            backgroundColor: bottomBg,
            borderColor: showZoneBorders ? border : undefined,
          }}
        >
          <SlideTransition
            slideKey={bottomRight.slide?.id || 'bottom-fallback'}
            enabled={enableTransitions && (bottomRight.info?.shouldRotate || false)}
            duration={0.6}
            transition={resolveTransition(bottomRight.slide)}
          >
            <div className="w-full h-full">
              {renderBottomRightPanel()}
            </div>
          </SlideTransition>
        </div>
      </div>

      {(topRight.info?.shouldRotate || false) && (
        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-black/[0.03]">
          <AnimatedProgressBar
            key={topRight.slide?.id || topRight.info?.currentSlideIndex || 0}
            durationSec={topDurationSec}
            startColor={accentGreen}
            endColor={accentGold}
          />
        </div>
      )}
    </div>
  );
}
