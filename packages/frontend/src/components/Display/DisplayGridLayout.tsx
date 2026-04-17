import { SlideRenderer } from '@/components/Display/SlideRenderer';
import { SlideTransition } from '@/components/Display/SlideTransition';
import type { DisplayLayoutContext } from '@/components/Display/displayLayoutRenderer.types';
import {
  DisplayEditorialPanel,
  DisplayEditorialStage,
  getEditorialStageMeta,
} from '@/components/Display/displayEditorialChrome';
import { isEditorialDisplayAppearance } from '@/config/displayDesignStyles';
import { classNames } from '@/utils/classNames';

interface DisplayGridLayoutProps {
  context: DisplayLayoutContext;
}

export function DisplayGridLayout({ context }: DisplayGridLayoutProps) {
  const {
    currentTime,
    displayDeviceId,
    effectiveSettings,
    enableTransitions,
    getZoneInfo,
    getZoneSlide,
    isModernDesign,
    localSchedule,
    mediaItems,
    onVideoEnded,
    renderSlideWithPadding,
    resolveTransition,
    showZoneBorders,
    themeColors,
    zones,
  } = context;

  const border = themeColors.gridTable || '#EBE5D3';
  const bgBase = themeColors.dashboardBg || themeColors.bg || '#FDFBF7';
  const bg1 = themeColors.zebra1 || bgBase;
  const bg2 = themeColors.zebra2 || bgBase;
  const progressColor = themeColors.accentGold || themeColors.accent || '#A68A64';

  const cellBgForIndex = (index: number) => (index === 0 || index === 3 ? bg1 : bg2);

  const renderCell = (zoneId: string) => {
    const slide = getZoneSlide(zoneId);

    const rendered = slide ? (
      <SlideRenderer
        schedule={localSchedule}
        settings={effectiveSettings}
        media={mediaItems}
        now={currentTime}
        deviceId={displayDeviceId}
        slide={slide}
        onVideoEnded={() => onVideoEnded(zoneId)}
      />
    ) : (
      <div className="w-full h-full flex items-center justify-center text-spa-text-secondary">
        Keine Slides
      </div>
    );

    if (!slide) return rendered;

    return renderSlideWithPadding(slide, rendered, {
      outerClassName: 'p-6 w-full h-full',
    });
  };

  if (isEditorialDisplayAppearance(context.displayAppearance)) {
    const stageMeta = getEditorialStageMeta(effectiveSettings, currentTime);

    return (
      <DisplayEditorialStage
        theme={themeColors}
        subtitle={stageMeta.subtitle}
        title={stageMeta.title}
        meta={stageMeta.meta}
        contentClassName="h-[calc(100%-4.25rem)]"
      >
        <div className="grid h-full grid-cols-2 grid-rows-2 gap-5">
          {zones.slice(0, 4).map((zone, index) => {
            const info = getZoneInfo(zone.id);
            const slide = getZoneSlide(zone.id);

            return (
              <DisplayEditorialPanel
                key={zone.id}
                theme={themeColors}
                tone={index % 2 === 0 ? 'paper' : 'glass'}
              >
                <SlideTransition
                  slideKey={slide?.id || `${zone.id}-empty`}
                  enabled={enableTransitions && (info?.shouldRotate || false)}
                  duration={0.6}
                  transition={resolveTransition(slide)}
                  progressDurationSec={
                    info?.shouldRotate ? (slide?.duration ?? 12) : undefined
                  }
                  progressColor={progressColor}
                >
                  {renderCell(zone.id)}
                </SlideTransition>
              </DisplayEditorialPanel>
            );
          })}
        </div>
      </DisplayEditorialStage>
    );
  }

  return (
    <div className="w-full h-full p-8" style={{ backgroundColor: isModernDesign ? bgBase : undefined }}>
      <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-6">
        {zones.slice(0, 4).map((zone, index) => {
          const info = getZoneInfo(zone.id);
          const slide = getZoneSlide(zone.id);

          return (
            <div
              key={zone.id}
              className={classNames(
                'relative overflow-hidden',
                isModernDesign ? 'rounded-[2rem]' : '',
                isModernDesign && showZoneBorders ? 'border' : '',
              )}
              style={{
                borderColor: isModernDesign && showZoneBorders ? border : undefined,
                backgroundColor: isModernDesign ? cellBgForIndex(index) : undefined,
              }}
            >
              <SlideTransition
                slideKey={slide?.id || `${zone.id}-empty`}
                enabled={enableTransitions && (info?.shouldRotate || false)}
                duration={0.6}
                transition={resolveTransition(slide)}
                progressDurationSec={
                  info?.shouldRotate ? (slide?.duration ?? 12) : undefined
                }
                progressColor={progressColor}
              >
                {renderCell(zone.id)}
              </SlideTransition>
            </div>
          );
        })}
      </div>
    </div>
  );
}
