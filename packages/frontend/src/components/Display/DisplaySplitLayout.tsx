import { SlideTransition } from '@/components/Display/SlideTransition';
import type { DisplayLayoutContext } from '@/components/Display/displayLayoutRenderer.types';
import { classNames } from '@/utils/classNames';

interface DisplaySplitLayoutProps {
  context: DisplayLayoutContext;
}

export function DisplaySplitLayout({ context }: DisplaySplitLayoutProps) {
  const {
    enableTransitions,
    getZoneInfo,
    getZoneSlide,
    isModernDesign,
    renderZoneSlide,
    resolveTransition,
    showZoneBorders,
    themeColors,
    zones,
  } = context;

  const splitZones = zones.filter((zone) => zone.id === 'persistent' || zone.id === 'main');
  const persistentZone = splitZones.find((zone) => zone.id === 'persistent');
  const mainZone = splitZones.find((zone) => zone.id === 'main');

  const gridSizePercent = persistentZone?.size || 50;
  const isVertical = persistentZone?.position === 'left' || persistentZone?.position === 'right';
  const scheduleFirst = persistentZone?.position === 'left' || persistentZone?.position === 'top';

  const persistentSlide = persistentZone ? getZoneSlide(persistentZone.id) : null;
  const persistentInfo = persistentZone ? getZoneInfo(persistentZone.id) : null;
  const mainSlide = mainZone ? getZoneSlide(mainZone.id) : null;
  const mainInfo = mainZone ? getZoneInfo(mainZone.id) : null;

  const leftBg = themeColors.zebra1 || '#F7F3E9';
  const rightBg = themeColors.zebra2 || '#F2EDE1';
  const border = themeColors.gridTable || '#EBE5D3';
  const progressColor = themeColors.accentGold || themeColors.accent || '#A68A64';

  const hasPersistent = Boolean(persistentSlide);
  const hasMain = Boolean(mainSlide);

  const persistentSize = hasPersistent && hasMain ? gridSizePercent : hasPersistent ? 100 : 0;
  const mainSize = hasPersistent && hasMain ? 100 - gridSizePercent : hasMain ? 100 : 0;

  if (isVertical) {
    return (
      <div className="w-full h-full flex">
        {scheduleFirst ? (
          <>
            {hasPersistent && (
              <div
                className={classNames(isModernDesign && hasMain && showZoneBorders && 'border-r')}
                style={{
                  width: `${persistentSize}%`,
                  borderColor: isModernDesign && showZoneBorders ? border : undefined,
                  backgroundColor: isModernDesign ? leftBg : undefined,
                }}
              >
                <SlideTransition
                  slideKey={persistentSlide?.id || 'persistent'}
                  enabled={enableTransitions && (persistentInfo?.shouldRotate || false)}
                  duration={0.6}
                  transition={resolveTransition(persistentSlide)}
                  progressDurationSec={persistentInfo?.shouldRotate ? (persistentSlide?.duration ?? 12) : undefined}
                  progressColor={progressColor}
                >
                  {renderZoneSlide(persistentSlide, persistentZone)}
                </SlideTransition>
              </div>
            )}

            {hasMain && (
              <div
                style={{
                  width: `${mainSize}%`,
                  backgroundColor: isModernDesign ? rightBg : undefined,
                }}
              >
                <SlideTransition
                  slideKey={mainSlide?.id || 'main'}
                  enabled={enableTransitions && (mainInfo?.shouldRotate || false)}
                  duration={0.6}
                  transition={resolveTransition(mainSlide)}
                  progressDurationSec={mainInfo?.shouldRotate ? (mainSlide?.duration ?? 12) : undefined}
                  progressColor={progressColor}
                >
                  {renderZoneSlide(mainSlide, mainZone)}
                </SlideTransition>
              </div>
            )}
          </>
        ) : (
          <>
            {hasMain && (
              <div
                className={classNames(isModernDesign && hasPersistent && showZoneBorders && 'border-r')}
                style={{
                  width: `${mainSize}%`,
                  borderColor: isModernDesign && showZoneBorders ? border : undefined,
                  backgroundColor: isModernDesign ? leftBg : undefined,
                }}
              >
                <SlideTransition
                  slideKey={mainSlide?.id || 'main'}
                  enabled={enableTransitions && (mainInfo?.shouldRotate || false)}
                  duration={0.6}
                  transition={resolveTransition(mainSlide)}
                  progressDurationSec={mainInfo?.shouldRotate ? (mainSlide?.duration ?? 12) : undefined}
                  progressColor={progressColor}
                >
                  {renderZoneSlide(mainSlide, mainZone)}
                </SlideTransition>
              </div>
            )}

            {hasPersistent && (
              <div
                style={{
                  width: `${persistentSize}%`,
                  backgroundColor: isModernDesign ? rightBg : undefined,
                }}
              >
                <SlideTransition
                  slideKey={persistentSlide?.id || 'persistent'}
                  enabled={enableTransitions && (persistentInfo?.shouldRotate || false)}
                  duration={0.6}
                  transition={resolveTransition(persistentSlide)}
                  progressDurationSec={persistentInfo?.shouldRotate ? (persistentSlide?.duration ?? 12) : undefined}
                  progressColor={progressColor}
                >
                  {renderZoneSlide(persistentSlide, persistentZone)}
                </SlideTransition>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {scheduleFirst ? (
        <>
          {hasPersistent && (
            <div
              className={classNames(isModernDesign && hasMain && showZoneBorders && 'border-b')}
              style={{
                height: `${persistentSize}%`,
                borderColor: isModernDesign && showZoneBorders ? border : undefined,
                backgroundColor: isModernDesign ? leftBg : undefined,
              }}
            >
              <SlideTransition
                slideKey={persistentSlide?.id || 'persistent'}
                enabled={enableTransitions && (persistentInfo?.shouldRotate || false)}
                duration={0.6}
                transition={resolveTransition(persistentSlide)}
                progressDurationSec={persistentInfo?.shouldRotate ? (persistentSlide?.duration ?? 12) : undefined}
                progressColor={progressColor}
              >
                {renderZoneSlide(persistentSlide, persistentZone)}
              </SlideTransition>
            </div>
          )}

          {hasMain && (
            <div
              style={{
                height: `${mainSize}%`,
                backgroundColor: isModernDesign ? rightBg : undefined,
              }}
            >
              <SlideTransition
                slideKey={mainSlide?.id || 'main'}
                enabled={enableTransitions && (mainInfo?.shouldRotate || false)}
                duration={0.6}
                transition={resolveTransition(mainSlide)}
                progressDurationSec={mainInfo?.shouldRotate ? (mainSlide?.duration ?? 12) : undefined}
                progressColor={progressColor}
              >
                {renderZoneSlide(mainSlide, mainZone)}
              </SlideTransition>
            </div>
          )}
        </>
      ) : (
        <>
          {hasMain && (
            <div
              className={classNames(isModernDesign && hasPersistent && showZoneBorders && 'border-b')}
              style={{
                height: `${mainSize}%`,
                borderColor: isModernDesign && showZoneBorders ? border : undefined,
                backgroundColor: isModernDesign ? leftBg : undefined,
              }}
            >
              <SlideTransition
                slideKey={mainSlide?.id || 'main'}
                enabled={enableTransitions && (mainInfo?.shouldRotate || false)}
                duration={0.6}
                transition={resolveTransition(mainSlide)}
                progressDurationSec={mainInfo?.shouldRotate ? (mainSlide?.duration ?? 12) : undefined}
                progressColor={progressColor}
              >
                {renderZoneSlide(mainSlide, mainZone)}
              </SlideTransition>
            </div>
          )}

          {hasPersistent && (
            <div
              style={{
                height: `${persistentSize}%`,
                backgroundColor: isModernDesign ? rightBg : undefined,
              }}
            >
              <SlideTransition
                slideKey={persistentSlide?.id || 'persistent'}
                enabled={enableTransitions && (persistentInfo?.shouldRotate || false)}
                duration={0.6}
                transition={resolveTransition(persistentSlide)}
                progressDurationSec={persistentInfo?.shouldRotate ? (persistentSlide?.duration ?? 12) : undefined}
                progressColor={progressColor}
              >
                {renderZoneSlide(persistentSlide, persistentZone)}
              </SlideTransition>
            </div>
          )}
        </>
      )}
    </div>
  );
}
