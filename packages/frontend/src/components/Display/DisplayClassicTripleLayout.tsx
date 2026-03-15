import { lazy, Suspense } from 'react';
import { SlideTransition } from '@/components/Display/SlideTransition';
import type {
  DisplayLayoutContext,
  TripleZoneStateMap,
} from '@/components/Display/displayLayoutRenderer.types';
import { loadScheduleGridSlide } from '@/components/Display/displayDynamicModules';
import {
  renderTripleSaunaDetail,
  renderTripleSlideRenderer,
} from '@/components/Display/displayTripleLayoutUtils';

interface DisplayClassicTripleLayoutProps {
  context: DisplayLayoutContext;
  zoneStates: TripleZoneStateMap;
}

const LazyScheduleGridSlide = lazy(loadScheduleGridSlide);

function ClassicTripleContentFallback() {
  return <div className="w-full h-full bg-spa-bg-primary" aria-hidden="true" />;
}

export function DisplayClassicTripleLayout({
  context,
  zoneStates,
}: DisplayClassicTripleLayoutProps) {
  const {
    currentTime,
    displayDeviceId,
    effectiveSettings,
    enableTransitions,
    localSchedule,
    resolveTransition,
  } = context;
  const { left, topRight, bottomRight } = zoneStates;

  const leftSize = left.zone?.size || 66;
  const topRightSize = topRight.zone?.size || 50;

  return (
    <div className="w-full h-full flex">
      {left.slide && (
        <div style={{ width: `${leftSize}%` }}>
          <SlideTransition
            slideKey={left.slide.id || 'left'}
            enabled={enableTransitions && (left.info?.shouldRotate || false)}
            duration={0.6}
            transition={resolveTransition(left.slide)}
          >
            {left.slide.type === 'content-panel' ? (
              <Suspense fallback={<ClassicTripleContentFallback />}>
                <LazyScheduleGridSlide
                  schedule={localSchedule}
                  settings={effectiveSettings}
                  now={currentTime}
                  deviceId={displayDeviceId}
                />
              </Suspense>
            ) : (
              renderTripleSlideRenderer(context, left.slide, left.zone?.id)
            )}
          </SlideTransition>
        </div>
      )}

      <div style={{ width: `${100 - leftSize}%` }} className="flex flex-col">
        {topRight.slide && (
          <div style={{ height: `${topRightSize}%` }}>
            <SlideTransition
              slideKey={topRight.slide.id || `top-right-${topRight.slide.saunaId || 0}`}
              enabled={enableTransitions && (topRight.info?.shouldRotate || false)}
              duration={0.6}
              transition={resolveTransition(topRight.slide)}
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
          <div style={{ height: `${100 - topRightSize}%` }}>
            <SlideTransition
              slideKey={bottomRight.slide.id || `bottom-right-${bottomRight.slide.saunaId || 1}`}
              enabled={enableTransitions && (bottomRight.info?.shouldRotate || false)}
              duration={0.6}
              transition={resolveTransition(bottomRight.slide)}
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
