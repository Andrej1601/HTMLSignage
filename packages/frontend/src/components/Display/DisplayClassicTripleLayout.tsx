import { SlideTransition } from '@/components/Display/SlideTransition';
import type {
  DisplayLayoutContext,
  TripleZoneStateMap,
} from '@/components/Display/displayLayoutRenderer.types';
import {
  renderTripleSaunaDetail,
  renderTripleSlideRenderer,
} from '@/components/Display/displayTripleLayoutUtils';
import { classNames } from '@/utils/classNames';
import { useDisplayViewportProfile } from '@/components/Display/useDisplayViewportProfile';

interface DisplayClassicTripleLayoutProps {
  context: DisplayLayoutContext;
  zoneStates: TripleZoneStateMap;
}

export function DisplayClassicTripleLayout({
  context,
  zoneStates,
}: DisplayClassicTripleLayoutProps) {
  const {
    enableTransitions,
    resolveTransition,
    themeColors,
  } = context;
  const { left, topRight, bottomRight } = zoneStates;
  const { containerRef, profile } = useDisplayViewportProfile<HTMLDivElement>();

  const isPortrait = profile.isPortrait;
  const leftSize = isPortrait ? 100 : (left.zone?.size || 66);
  const topRightSize = topRight.zone?.size || 50;
  const progressColor = themeColors.accentGold || themeColors.accent || '#A68A64';

  return (
    <div
      ref={containerRef}
      className={classNames('w-full h-full', isPortrait ? 'flex flex-col' : 'flex')}
    >
      {left.slide && (
        <div
          style={{
            width: isPortrait ? '100%' : `${leftSize}%`,
            height: isPortrait ? '54%' : '100%',
          }}
        >
          <SlideTransition
            slideKey={left.slide.id || 'left'}
            enabled={enableTransitions && (left.info?.shouldRotate || false)}
            duration={0.6}
            transition={resolveTransition(left.slide)}
            progressDurationSec={
              left.info?.shouldRotate ? (left.slide.duration ?? 12) : undefined
            }
            progressColor={progressColor}
          >
            {renderTripleSlideRenderer(context, left.slide, left.zone?.id)}
          </SlideTransition>
        </div>
      )}

      <div
        style={{
          width: isPortrait ? '100%' : `${100 - leftSize}%`,
          height: isPortrait ? '46%' : '100%',
        }}
        className="flex min-h-0 flex-col"
      >
        {topRight.slide && (
          <div style={{ height: isPortrait ? '56%' : `${topRightSize}%` }}>
            <SlideTransition
              slideKey={topRight.slide.id || `top-right-${topRight.slide.saunaId || 0}`}
              enabled={enableTransitions && (topRight.info?.shouldRotate || false)}
              duration={0.6}
              transition={resolveTransition(topRight.slide)}
              progressDurationSec={
                topRight.info?.shouldRotate ? (topRight.slide.duration ?? 12) : undefined
              }
              progressColor={progressColor}
            >
              {topRight.slide.type === 'sauna-detail' ? (
                renderTripleSaunaDetail(context, topRight.slide.saunaId)
              ) : (
                renderTripleSlideRenderer(context, topRight.slide, topRight.zone?.id)
              )}
            </SlideTransition>
          </div>
        )}

        {bottomRight.slide && (
          <div style={{ height: isPortrait ? '44%' : `${100 - topRightSize}%` }}>
            <SlideTransition
              slideKey={bottomRight.slide.id || `bottom-right-${bottomRight.slide.saunaId || 1}`}
              enabled={enableTransitions && (bottomRight.info?.shouldRotate || false)}
              duration={0.6}
              transition={resolveTransition(bottomRight.slide)}
              progressDurationSec={
                bottomRight.info?.shouldRotate ? (bottomRight.slide.duration ?? 12) : undefined
              }
              progressColor={progressColor}
            >
              {bottomRight.slide.type === 'sauna-detail' ? (
                renderTripleSaunaDetail(context, bottomRight.slide.saunaId)
              ) : (
                renderTripleSlideRenderer(context, bottomRight.slide, bottomRight.zone?.id)
              )}
            </SlideTransition>
          </div>
        )}
      </div>
    </div>
  );
}
