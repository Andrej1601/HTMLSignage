import type { ReactElement } from 'react';
import { SlideTransition } from '@/components/Display/SlideTransition';
import { WellnessBottomPanel } from '@/components/Display/WellnessBottomPanel';
import type {
  DisplayLayoutContext,
  TripleZoneStateMap,
} from '@/components/Display/displayLayoutRenderer.types';
import {
  renderTripleSaunaDetail,
  renderTripleSlideRenderer,
} from '@/components/Display/displayTripleLayoutUtils';
import {
  MineralNoirPanel,
  MineralNoirStage,
  getMineralNoirStageMeta,
} from '@/components/Display/displayMineralNoirChrome';
import { classNames } from '@/utils/classNames';
import { useDisplayViewportProfile } from '@/components/Display/useDisplayViewportProfile';
import { getMineralTokens } from '@/components/Display/displayMineralNoirChrome';

interface DisplayMineralNoirTripleLayoutProps {
  context: DisplayLayoutContext;
  zoneStates: TripleZoneStateMap;
}

/**
 * Rendert ein Media-Slide full-bleed (kein Padding, kein Rounding) mit
 * dramatischem Gradient-Overlay am unteren Bildrand — Mineral Noir Signatur.
 */
function renderFullBleedMediaSlide(
  context: DisplayLayoutContext,
  slide: NonNullable<TripleZoneStateMap['left']['slide']>,
  zoneId: string | undefined,
  overlayColor: string,
): ReactElement {
  const rendered = renderTripleSlideRenderer(context, slide, zoneId);
  return (
    <div className="relative w-full h-full">
      {rendered}
      {/* Dramatischer Gradient-Overlay — von unten nach oben */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: '55%',
          background: `linear-gradient(to top, ${overlayColor} 0%, transparent 100%)`,
        }}
      />
    </div>
  );
}

/** Gibt true zurück wenn das Slide-Format einen vollen Bildschirm will (kein Stripe-Padding) */
function wantsFullBleed(type: string | undefined): boolean {
  if (!type) return false;
  return type.startsWith('media-') || type === 'sauna-detail' || type === 'events';
}

export function DisplayMineralNoirTripleLayout({
  context,
  zoneStates,
}: DisplayMineralNoirTripleLayoutProps) {
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
  const stageMeta = getMineralNoirStageMeta(effectiveSettings, currentTime);
  const t = getMineralTokens(themeColors);

  const isPortrait = profile.isPortrait;
  const isCompact = profile.isCompact;
  const leftSize = isPortrait ? 100 : (left.zone?.size || 62);
  const rightSize = isPortrait ? 100 : 100 - leftSize;
  const rightBottomClassName = isPortrait
    ? 'flex-[0.9] min-h-0'
    : isCompact ? 'h-36 shrink-0' : 'h-52 shrink-0';
  const progressColor = themeColors.accentGold || themeColors.accent || '#C5A059';

  const renderLeftPanel = (): ReactElement => {
    if (!left.slide || left.slide.type === 'content-panel') return renderContentPanel();
    if (left.slide.type.startsWith('media-')) {
      return renderFullBleedMediaSlide(context, left.slide, left.zone?.id, t.bg);
    }
    // sauna-detail + everything else routes through the pack via SlideRenderer.
    return renderTripleSlideRenderer(context, left.slide, left.zone?.id);
  };

  const renderTopRightPanel = (): ReactElement => {
    if (topRight.slide) {
      if (topRight.slide.type.startsWith('media-')) {
        return renderFullBleedMediaSlide(context, topRight.slide, topRight.zone?.id, t.bg);
      }
      return <div className="h-full w-full">{renderTripleSlideRenderer(context, topRight.slide, topRight.zone?.id)}</div>;
    }
    return renderTripleSaunaDetail(context, undefined);
  };

  const renderBottomRightPanel = (): ReactElement => {
    if (bottomRight.slide) {
      if (bottomRight.slide.type.startsWith('media-')) {
        return renderFullBleedMediaSlide(context, bottomRight.slide, bottomRight.zone?.id, t.bg);
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

  // Mineral Noir: kein gap zwischen Panels — Hairline-Trennlinie stattdessen
  const gap = 'gap-px';

  return (
    <MineralNoirStage
      theme={themeColors}
      subtitle={stageMeta.subtitle}
      title={stageMeta.title}
      meta={stageMeta.meta}
    >
      <div
        ref={containerRef}
        className={classNames('h-full min-h-0', isPortrait ? 'flex flex-col' : 'flex', gap)}
      >
        {/* Left — primary schedule panel */}
        <div
          className={classNames(isPortrait && 'min-h-0 flex-[1.2]')}
          style={{ width: isPortrait ? '100%' : `${leftSize}%` }}
        >
          <MineralNoirPanel
            theme={themeColors}
            accentTone="emerald"
            fullBleed={wantsFullBleed(left.slide?.type)}
          >
            <SlideTransition
              slideKey={left.slide?.id || left.info?.currentSlideIndex || 'left-fallback'}
              enabled={enableTransitions && (left.info?.shouldRotate || false)}
              duration={0.5}
              transition={resolveTransition(left.slide)}
              progressDurationSec={
                left.info?.shouldRotate ? (left.slide?.duration ?? 12) : undefined
              }
              progressColor={progressColor}
            >
              <div className="h-full w-full">{renderLeftPanel()}</div>
            </SlideTransition>
          </MineralNoirPanel>
        </div>

        {/* Right column */}
        <div
          className={classNames('flex min-h-0 flex-col', isPortrait ? 'flex-1' : 'h-full', gap)}
          style={{ width: isPortrait ? '100%' : `${rightSize}%` }}
        >
          <div className="relative flex-1 min-h-0">
            <MineralNoirPanel
              theme={themeColors}
              accentTone="platinum"
              fullBleed={wantsFullBleed(topRight.slide?.type)}
            >
              <SlideTransition
                slideKey={topRight.slide?.id || topRight.info?.currentSlideIndex || 'top-fallback'}
                enabled={enableTransitions && (topRight.info?.shouldRotate || false)}
                duration={0.5}
                transition={resolveTransition(topRight.slide)}
                progressDurationSec={
                  topRight.info?.shouldRotate ? (topRight.slide?.duration ?? 12) : undefined
                }
                progressColor={progressColor}
              >
                <div className="h-full w-full">{renderTopRightPanel()}</div>
              </SlideTransition>
            </MineralNoirPanel>
          </div>

          <div className={classNames('relative', rightBottomClassName)}>
            <MineralNoirPanel
              theme={themeColors}
              accentTone="none"
              fullBleed={wantsFullBleed(bottomRight.slide?.type)}
            >
              <SlideTransition
                slideKey={bottomRight.slide?.id || bottomRight.info?.currentSlideIndex || 'bottom-fallback'}
                enabled={enableTransitions && (bottomRight.info?.shouldRotate || false)}
                duration={0.5}
                transition={resolveTransition(bottomRight.slide)}
                progressDurationSec={
                  bottomRight.info?.shouldRotate ? (bottomRight.slide?.duration ?? 12) : undefined
                }
                progressColor={progressColor}
              >
                <div className="h-full w-full">{renderBottomRightPanel()}</div>
              </SlideTransition>
            </MineralNoirPanel>
          </div>
        </div>
      </div>
    </MineralNoirStage>
  );
}
