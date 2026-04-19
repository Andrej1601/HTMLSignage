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
import {
  DisplayEditorialPanel,
  DisplayEditorialStage,
  getEditorialStageMeta,
} from '@/components/Display/displayEditorialChrome';
import { classNames } from '@/utils/classNames';
import { useDisplayViewportProfile } from '@/components/Display/useDisplayViewportProfile';

interface DisplayEditorialTripleLayoutProps {
  context: DisplayLayoutContext;
  zoneStates: TripleZoneStateMap;
}

export function DisplayEditorialTripleLayout({
  context,
  zoneStates,
}: DisplayEditorialTripleLayoutProps) {
  const {
    currentTime,
    displayAppearance,
    enableTransitions,
    effectiveSettings,
    renderContentPanel,
    resolveTransition,
    themeColors,
    mediaItems,
  } = context;
  const { left, topRight, bottomRight } = zoneStates;
  const { containerRef, profile } = useDisplayViewportProfile<HTMLDivElement>();
  const stageMeta = getEditorialStageMeta(effectiveSettings, currentTime);

  const isPortrait = profile.isPortrait;
  const isCompact = profile.isCompact;
  const leftSize = isPortrait ? 100 : (left.zone?.size || 60);
  const rightSize = isPortrait ? 100 : 100 - leftSize;
  const topDurationSec = topRight.slide?.duration ?? 12;
  const accentWarm = themeColors.accentGold || themeColors.accent || '#A68A64';
  const stageContentClassName = isPortrait ? 'gap-3' : isCompact ? 'gap-3.5' : 'gap-5';
  const rightBottomClassName = isPortrait
    ? 'flex-[0.9] min-h-0'
    : isCompact
      ? 'h-40 shrink-0'
      : 'h-56 shrink-0';

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
    if (topRight.slide) {
      if (topRight.slide.type.startsWith('media-')) {
        return renderTriplePaddedSlide(context, topRight.slide, topRight.zone?.id, {
          outerClassName: 'p-5 w-full h-full',
          innerClassName: 'w-full h-full rounded-[1.9rem] overflow-hidden border-[4px] border-white/80 shadow-xl',
        });
      }

      // sauna-detail routes through the pack via SlideRenderer.
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
    >
      <div
        ref={containerRef}
        className={classNames('h-full min-h-0', isPortrait ? 'flex flex-col' : 'flex', stageContentClassName)}
      >
        <div
          className={classNames(isPortrait && 'min-h-0 flex-[1.2]')}
          style={{ width: isPortrait ? '100%' : `${leftSize}%` }}
        >
          <DisplayEditorialPanel
            theme={themeColors}
            tone="paper"
          >
            <SlideTransition
              slideKey={left.slide?.id || left.info?.currentSlideIndex || 'left-fallback'}
              enabled={enableTransitions && (left.info?.shouldRotate || false)}
              duration={0.6}
              transition={resolveTransition(left.slide)}
              progressDurationSec={
                left.info?.shouldRotate ? (left.slide?.duration ?? 12) : undefined
              }
              progressColor={accentWarm}
            >
              <div className="h-full w-full">
                {renderLeftPanel()}
              </div>
            </SlideTransition>
          </DisplayEditorialPanel>
        </div>

        <div
          className={classNames('flex min-h-0 flex-col', isPortrait ? 'flex-1' : 'h-full', stageContentClassName)}
          style={{ width: isPortrait ? '100%' : `${rightSize}%` }}
        >
          <div className="relative flex-1 min-h-0">
            <DisplayEditorialPanel
              theme={themeColors}
              tone="glass"
            >
              <SlideTransition
                slideKey={topRight.slide?.id || topRight.info?.currentSlideIndex || 'top-fallback'}
                enabled={enableTransitions && (topRight.info?.shouldRotate || false)}
                duration={0.6}
                transition={resolveTransition(topRight.slide)}
                progressDurationSec={topRight.info?.shouldRotate ? topDurationSec : undefined}
                progressColor={accentWarm}
              >
                <div className="h-full w-full">
                  {renderTopRightPanel()}
                </div>
              </SlideTransition>
            </DisplayEditorialPanel>
          </div>

          <div className={classNames('relative', rightBottomClassName)}>
            <DisplayEditorialPanel
              theme={themeColors}
              tone="accent"
              contentClassName={classNames(!bottomRight.slide && (isCompact ? 'px-4 py-4' : 'px-6 py-5'))}
            >
              <SlideTransition
                slideKey={bottomRight.slide?.id || bottomRight.info?.currentSlideIndex || 'bottom-fallback'}
                enabled={enableTransitions && (bottomRight.info?.shouldRotate || false)}
                duration={0.6}
                transition={resolveTransition(bottomRight.slide)}
                progressDurationSec={
                  bottomRight.info?.shouldRotate ? (bottomRight.slide?.duration ?? 12) : undefined
                }
                progressColor={accentWarm}
              >
                <div className="h-full w-full">
                  {renderBottomRightPanel()}
                </div>
              </SlideTransition>
            </DisplayEditorialPanel>
          </div>
        </div>
      </div>

    </DisplayEditorialStage>
  );
}
