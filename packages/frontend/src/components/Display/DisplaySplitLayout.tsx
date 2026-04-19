import { SlideTransition } from '@/components/Display/SlideTransition';
import type { DisplayLayoutContext } from '@/components/Display/displayLayoutRenderer.types';
import {
  DisplayEditorialPanel,
  DisplayEditorialStage,
  getEditorialStageMeta,
} from '@/components/Display/displayEditorialChrome';
import {
  MineralNoirPanel,
  MineralNoirStage,
  getMineralNoirStageMeta,
} from '@/components/Display/displayMineralNoirChrome';
import { isEditorialDisplayAppearance, isMineralNoirDisplayAppearance } from '@/config/displayDesignStyles';
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

  if (isMineralNoirDisplayAppearance(context.displayAppearance)) {
    const stageMeta = getMineralNoirStageMeta(context.effectiveSettings, context.currentTime, context.mediaItems);
    const renderNoirPanel = (
      slide: typeof persistentSlide,
      info: typeof persistentInfo,
      zone: typeof persistentZone,
      accentTone: 'emerald' | 'platinum',
    ) => (
      <MineralNoirPanel
        theme={themeColors}
        accentTone={accentTone}
        fullBleed={Boolean(slide?.type && (slide.type.startsWith('media-') || slide.type === 'sauna-detail' || slide.type === 'events'))}
      >
        <SlideTransition
          slideKey={slide?.id || `${zone?.id || accentTone}-empty`}
          enabled={enableTransitions && (info?.shouldRotate || false)}
          duration={0.5}
          transition={resolveTransition(slide)}
          progressDurationSec={info?.shouldRotate ? (slide?.duration ?? 12) : undefined}
          progressColor={progressColor}
        >
          <div className="relative w-full h-full">
            {renderZoneSlide(slide, zone || undefined)}
            {/* Full-bleed gradient overlay für Media-Slides */}
            {slide?.type.startsWith('media-') && (
              <div
                className="absolute inset-x-0 bottom-0 pointer-events-none"
                style={{
                  height: '50%',
                  background: `linear-gradient(to top, ${themeColors.dashboardBg || '#0D0F14'} 0%, transparent 100%)`,
                }}
              />
            )}
          </div>
        </SlideTransition>
      </MineralNoirPanel>
    );

    if (isVertical) {
      return (
        <MineralNoirStage theme={themeColors} subtitle={stageMeta.subtitle} title={stageMeta.title} meta={stageMeta.meta} logoImageUrl={stageMeta.logoImageUrl}>
          <div className="flex h-full gap-px">
            {scheduleFirst ? (
              <>
                {hasPersistent && <div style={{ width: `${persistentSize}%` }} className="h-full">{renderNoirPanel(persistentSlide, persistentInfo, persistentZone, 'emerald')}</div>}
                {hasMain && <div style={{ width: `${mainSize}%` }} className="h-full">{renderNoirPanel(mainSlide, mainInfo, mainZone, 'platinum')}</div>}
              </>
            ) : (
              <>
                {hasMain && <div style={{ width: `${mainSize}%` }} className="h-full">{renderNoirPanel(mainSlide, mainInfo, mainZone, 'emerald')}</div>}
                {hasPersistent && <div style={{ width: `${persistentSize}%` }} className="h-full">{renderNoirPanel(persistentSlide, persistentInfo, persistentZone, 'platinum')}</div>}
              </>
            )}
          </div>
        </MineralNoirStage>
      );
    }

    return (
      <MineralNoirStage theme={themeColors} subtitle={stageMeta.subtitle} title={stageMeta.title} meta={stageMeta.meta} logoImageUrl={stageMeta.logoImageUrl}>
        <div className="flex h-full flex-col gap-px">
          {scheduleFirst ? (
            <>
              {hasPersistent && <div style={{ height: `${persistentSize}%` }}>{renderNoirPanel(persistentSlide, persistentInfo, persistentZone, 'emerald')}</div>}
              {hasMain && <div style={{ height: `${mainSize}%` }}>{renderNoirPanel(mainSlide, mainInfo, mainZone, 'platinum')}</div>}
            </>
          ) : (
            <>
              {hasMain && <div style={{ height: `${mainSize}%` }}>{renderNoirPanel(mainSlide, mainInfo, mainZone, 'emerald')}</div>}
              {hasPersistent && <div style={{ height: `${persistentSize}%` }}>{renderNoirPanel(persistentSlide, persistentInfo, persistentZone, 'platinum')}</div>}
            </>
          )}
        </div>
      </MineralNoirStage>
    );
  }

  if (isEditorialDisplayAppearance(context.displayAppearance)) {
    const stageMeta = getEditorialStageMeta(context.effectiveSettings, context.currentTime, context.mediaItems);
    const renderPanel = (
      slide: typeof persistentSlide,
      info: typeof persistentInfo,
      zone: typeof persistentZone,
      tone: 'paper' | 'glass',
    ) => (
      <DisplayEditorialPanel
        theme={themeColors}
        tone={tone}
      >
        <SlideTransition
          slideKey={slide?.id || `${zone?.id || tone}-empty`}
          enabled={enableTransitions && (info?.shouldRotate || false)}
          duration={0.6}
          transition={resolveTransition(slide)}
          progressDurationSec={info?.shouldRotate ? (slide?.duration ?? 12) : undefined}
          progressColor={progressColor}
        >
          {renderZoneSlide(slide, zone || undefined)}
        </SlideTransition>
      </DisplayEditorialPanel>
    );

    if (isVertical) {
      return (
        <DisplayEditorialStage
          theme={themeColors}
          subtitle={stageMeta.subtitle}
          title={stageMeta.title}
          meta={stageMeta.meta}
          logoImageUrl={stageMeta.logoImageUrl}
          contentClassName="h-[calc(100%-4.25rem)]"
        >
          <div className="flex h-full gap-5">
            {scheduleFirst ? (
              <>
                {hasPersistent && (
                  <div style={{ width: `${persistentSize}%` }}>
                    {renderPanel(persistentSlide, persistentInfo, persistentZone, 'paper')}
                  </div>
                )}
                {hasMain && (
                  <div style={{ width: `${mainSize}%` }}>
                    {renderPanel(mainSlide, mainInfo, mainZone, 'glass')}
                  </div>
                )}
              </>
            ) : (
              <>
                {hasMain && (
                  <div style={{ width: `${mainSize}%` }}>
                    {renderPanel(mainSlide, mainInfo, mainZone, 'paper')}
                  </div>
                )}
                {hasPersistent && (
                  <div style={{ width: `${persistentSize}%` }}>
                    {renderPanel(persistentSlide, persistentInfo, persistentZone, 'glass')}
                  </div>
                )}
              </>
            )}
          </div>
        </DisplayEditorialStage>
      );
    }

    return (
      <DisplayEditorialStage
        theme={themeColors}
        subtitle={stageMeta.subtitle}
        title={stageMeta.title}
        meta={stageMeta.meta}
        logoImageUrl={stageMeta.logoImageUrl}
        contentClassName="h-[calc(100%-4.25rem)]"
      >
        <div className="flex h-full flex-col gap-5">
          {scheduleFirst ? (
            <>
              {hasPersistent && (
                <div style={{ height: `${persistentSize}%` }}>
                  {renderPanel(persistentSlide, persistentInfo, persistentZone, 'paper')}
                </div>
              )}
              {hasMain && (
                <div style={{ height: `${mainSize}%` }}>
                  {renderPanel(mainSlide, mainInfo, mainZone, 'glass')}
                </div>
              )}
            </>
          ) : (
            <>
              {hasMain && (
                <div style={{ height: `${mainSize}%` }}>
                  {renderPanel(mainSlide, mainInfo, mainZone, 'paper')}
                </div>
              )}
              {hasPersistent && (
                <div style={{ height: `${persistentSize}%` }}>
                  {renderPanel(persistentSlide, persistentInfo, persistentZone, 'glass')}
                </div>
              )}
            </>
          )}
        </div>
      </DisplayEditorialStage>
    );
  }

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
