import { SlideTransition } from '@/components/Display/SlideTransition';
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
import { useDisplayViewportProfile } from '@/components/Display/useDisplayViewportProfile';

interface DisplayModernTripleLayoutProps {
  context: DisplayLayoutContext;
  zoneStates: TripleZoneStateMap;
}

export function DisplayModernTripleLayout({
  context,
  zoneStates,
}: DisplayModernTripleLayoutProps) {
  const {
    designStyle,
    enableTransitions,
    renderContentPanel,
    resolveTransition,
    showZoneBorders,
    themeColors,
  } = context;
  const { left, topRight, bottomRight } = zoneStates;
  const { containerRef, profile } = useDisplayViewportProfile<HTMLDivElement>();

  const isPortrait = profile.isPortrait;
  const isCompact = profile.isCompact;
  const leftSize = isPortrait ? 100 : (left.zone?.size || (designStyle === 'modern-timeline' ? 65 : 60));
  const rightSize = isPortrait ? 100 : 100 - leftSize;
  const topDurationSec = topRight.slide?.duration ?? 12;

  const leftBg = themeColors.zebra1 || '#F7F3E9';
  const rightBg = themeColors.zebra2 || '#F2EDE1';
  const border = themeColors.gridTable || '#EBE5D3';
  const bottomBg = withAlpha(rightBg, 0.6);

  const accentGold = themeColors.accentGold || themeColors.accent || '#A68A64';
  // Bottom-right panel fills the zone edge-to-edge. The previous
  // `p-2.5` / `p-3` / `p-4` outer padding added a visible gutter
  // around the embedded slide that modern packs already handle
  // with their own inner spacing.
  const bottomPanelClassName = isPortrait
    ? 'flex-[0.9] min-h-0'
    : isCompact
      ? 'h-32'
      : 'h-44';

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
    if (topRight.slide) {
      if (topRight.slide.type.startsWith('media-')) {
        return renderTriplePaddedSlide(context, topRight.slide, topRight.zone?.id, {
          outerClassName: 'p-5 w-full h-full',
          innerClassName: 'w-full h-full rounded-[2.3rem] overflow-hidden border-[6px] border-white shadow-xl',
        });
      }

      // sauna-detail and everything else route through the SlideRenderer
      // dispatcher so the active design pack can render it (e.g. the
      // wellness-classic SaunaDetailRenderer's image + infusion-list
      // layout).
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

    // Empty bottom-right zone — show a quiet placeholder so operators
    // see the gap. The previous Wellness-styled tips/events fallback was
    // retired with the rest of the legacy chrome pipeline.
    return (
      <div className="flex h-full w-full items-center justify-center text-spa-text-secondary text-sm">
        Keine Slides
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={classNames(
        'w-full h-full relative overflow-hidden',
        isPortrait ? 'flex flex-col' : 'flex',
      )}
    >
      <div
        className={classNames(
          'h-full relative overflow-hidden',
          showZoneBorders && (isPortrait ? 'border-b' : 'border-r'),
        )}
        style={{
          width: isPortrait ? '100%' : `${leftSize}%`,
          height: isPortrait ? '54%' : '100%',
          backgroundColor: leftBg,
          borderColor: showZoneBorders ? border : undefined,
        }}
      >
        <SlideTransition
          slideKey={left.slide?.id || `content-panel-${designStyle}`}
          enabled={enableTransitions && (left.info?.shouldRotate || false)}
          duration={0.6}
          transition={resolveTransition(left.slide)}
          progressDurationSec={
            left.info?.shouldRotate ? (left.slide?.duration ?? 12) : undefined
          }
          progressColor={accentGold}
        >
          {renderLeftPanel()}
        </SlideTransition>
      </div>

      <div
        className="flex min-h-0 flex-col relative overflow-hidden"
        style={{
          width: isPortrait ? '100%' : `${rightSize}%`,
          height: isPortrait ? '46%' : '100%',
          backgroundColor: rightBg,
        }}
      >
        <div className="flex-1 relative overflow-hidden flex flex-col">
          <SlideTransition
            slideKey={topRight.slide?.id || topRight.info?.currentSlideIndex || 'top-fallback'}
            enabled={enableTransitions && (topRight.info?.shouldRotate || false)}
            duration={0.6}
            transition={resolveTransition(topRight.slide)}
            progressDurationSec={topRight.info?.shouldRotate ? topDurationSec : undefined}
            progressColor={accentGold}
          >
            <div className="absolute inset-0 flex flex-col">
              {renderTopRightPanel()}
            </div>
          </SlideTransition>
        </div>

        <div
          className={classNames('relative shrink-0 overflow-hidden', bottomPanelClassName, showZoneBorders && 'border-t')}
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
            progressDurationSec={
              bottomRight.info?.shouldRotate ? (bottomRight.slide?.duration ?? 12) : undefined
            }
            progressColor={accentGold}
          >
            <div className="w-full h-full">
              {renderBottomRightPanel()}
            </div>
          </SlideTransition>
        </div>
      </div>
    </div>
  );
}
