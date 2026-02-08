import { useEffect, useState } from 'react';
import { useSchedule } from '@/hooks/useSchedule';
import { useSettings } from '@/hooks/useSettings';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useSlideshow } from '@/hooks/useSlideshow';
import { OverviewSlide } from '@/components/Display/OverviewSlide';
import { SlideRenderer } from '@/components/Display/SlideRenderer';
import { DisplayHeader } from '@/components/Display/DisplayHeader';
import { ScheduleGridSlide } from '@/components/Display/ScheduleGridSlide';
import { SaunaDetailDashboard } from '@/components/Display/SaunaDetailDashboard';
import { SlideTransition } from '@/components/Display/SlideTransition';
import { getDefaultSettings } from '@/types/settings.types';
import type { PairingResponse } from '@/types/auth.types';
import clsx from 'clsx';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

// Generate a unique browser ID (UUID v4)
function generateBrowserId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function DisplayClientPage() {
  // Get or create unique browser ID (persists across page reloads)
  const [browserId] = useState(() => {
    let id = localStorage.getItem('browserId');
    if (!id) {
      id = generateBrowserId();
      localStorage.setItem('browserId', id);
    }
    return id;
  });

  const [pairingInfo, setPairingInfo] = useState<PairingResponse | null>(null);
  const [isPairingLoading, setIsPairingLoading] = useState(true);

  const { schedule, isLoading: scheduleLoading } = useSchedule();
  const { settings: fetchedSettings, isLoading: settingsLoading } = useSettings();

  const [localSchedule, setLocalSchedule] = useState(schedule);
  const [localSettings, setLocalSettings] = useState(fetchedSettings || getDefaultSettings());

  // Check pairing status
  useEffect(() => {
    const checkPairing = async () => {
      setIsPairingLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/devices/request-pairing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ browserId }),
        });

        if (response.ok) {
          const data: PairingResponse = await response.json();
          setPairingInfo(data);
        }
      } catch (error) {
        console.error('[Display] Pairing check failed:', error);
      } finally {
        setIsPairingLoading(false);
      }
    };

    checkPairing();

    // Re-check pairing every 10 seconds
    const interval = setInterval(checkPairing, 10000);
    return () => clearInterval(interval);
  }, [browserId]);

  // Update local state when data is fetched
  useEffect(() => {
    if (schedule) setLocalSchedule(schedule);
  }, [schedule]);

  useEffect(() => {
    if (fetchedSettings) setLocalSettings(fetchedSettings);
  }, [fetchedSettings]);

  // WebSocket for real-time updates
  const { isConnected, subscribe } = useWebSocket({
    onScheduleUpdate: (data) => {
      console.log('[Display] Schedule updated via WebSocket');
      setLocalSchedule(data);
    },
    onSettingsUpdate: (data) => {
      console.log('[Display] Settings updated via WebSocket');
      setLocalSettings(data);
    },
    onDeviceCommand: (command) => {
      console.log('[Display] Command received:', command);
      if (command === 'reload' || command === 'restart') {
        window.location.reload();
      }
      if (command === 'clear-cache') {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
      }
    },
  });

  // Subscribe to updates once connected and paired
  useEffect(() => {
    if (isConnected && pairingInfo?.paired && pairingInfo?.id) {
      subscribe('schedule');
      subscribe('settings');
      subscribe('device', pairingInfo.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, pairingInfo?.paired, pairingInfo?.id]);

  // Heartbeat system (only when paired)
  useEffect(() => {
    if (!pairingInfo?.paired || !pairingInfo?.id) return;

    const sendHeartbeat = async () => {
      try {
        const response = await fetch(`${API_URL}/api/devices/${pairingInfo.id}/heartbeat`, {
          method: 'POST',
        });
        if (response.ok) {
          console.log('[Display] Heartbeat sent');
        }
      } catch (error) {
        console.error('[Display] Heartbeat failed:', error);
      }
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Send heartbeat every 2 minutes
    const interval = setInterval(sendHeartbeat, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [pairingInfo]);

  // Slideshow
  const {
    currentSlide,
    currentSlideIndex,
    totalSlides,
    layout,
    enableTransitions,
    showSlideIndicators,
    onVideoEnded,
    zones,
    getZoneSlide,
    getZoneInfo,
  } = useSlideshow({
    settings: localSettings,
    enabled: true,
  });

  // Pairing screen - show if not paired
  if (isPairingLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-spa-primary to-spa-primary-dark text-white">
        <div className="text-center">
          <div className="text-3xl font-bold mb-4">HTMLSignage</div>
          <div className="text-lg">Wird geladen...</div>
        </div>
      </div>
    );
  }

  if (!pairingInfo?.paired && pairingInfo?.pairingCode) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-spa-primary to-spa-primary-dark text-white">
        <div className="text-center max-w-2xl px-8">
          <div className="text-4xl font-bold mb-8">HTMLSignage</div>

          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 mb-8">
            <h2 className="text-2xl font-semibold mb-6">Gerät nicht gepairt</h2>
            <p className="text-lg mb-8 opacity-90">
              Bitte geben Sie diesen Pairing-Code im Admin-Interface ein:
            </p>

            <div className="bg-white text-spa-primary rounded-2xl p-8 mb-6">
              <div className="text-7xl font-bold tracking-wider font-mono">
                {pairingInfo.pairingCode}
              </div>
            </div>

            <p className="text-sm opacity-75">
              Öffnen Sie das Admin-Interface unter /devices und geben Sie diesen Code ein.
            </p>
          </div>

          <div className="text-sm opacity-60">
            Device ID: {pairingInfo.id.slice(0, 12)}...
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (scheduleLoading || settingsLoading || !localSchedule) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-2xl font-bold mb-4">HTMLSignage</div>
          <div className="text-lg">Wird geladen...</div>
          <div className="text-sm mt-2 opacity-70">
            {isConnected ? 'Verbunden' : 'Verbinde...'}
          </div>
        </div>
      </div>
    );
  }

  // If no slides configured, show default overview
  if (!currentSlide || totalSlides === 0) {
    const designStyle = localSettings.designStyle || 'classic';

    return (
      <div className="w-full h-screen overflow-hidden">
        {designStyle === 'modern-wellness' ? (
          <ScheduleGridSlide schedule={localSchedule} settings={localSettings} />
        ) : (
          <OverviewSlide schedule={localSchedule} settings={localSettings} />
        )}
      </div>
    );
  }

  // Get defaults for header and theme
  const defaults = getDefaultSettings();
  const headerSettings = localSettings.header || defaults.header!;
  const themeColors = localSettings.theme || defaults.theme!;

  // Render based on layout
  const renderLayout = () => {
    switch (layout) {
      case 'full-rotation':
        return (
          <SlideTransition
            slideKey={currentSlide?.id || currentSlideIndex}
            enabled={enableTransitions}
            duration={0.6}
          >
            <SlideRenderer slide={currentSlide} onVideoEnded={onVideoEnded} />
          </SlideTransition>
        );

      case 'split-view':
        // Get zones for this layout
        const splitZones = zones.filter((z) => z.id === 'persistent' || z.id === 'main');
        const persistentZone = splitZones.find((z) => z.id === 'persistent');
        const mainZone = splitZones.find((z) => z.id === 'main');

        const gridSizePercent = persistentZone?.size || 50;
        const isVertical = persistentZone?.position === 'left' || persistentZone?.position === 'right';
        const scheduleFirst = persistentZone?.position === 'left' || persistentZone?.position === 'top';

        // Get slides for each zone
        const persistentSlide = persistentZone ? getZoneSlide(persistentZone.id) : null;
        const persistentInfo = persistentZone ? getZoneInfo(persistentZone.id) : null;
        const mainSlide = mainZone ? getZoneSlide(mainZone.id) : currentSlide;

        if (isVertical) {
          return (
            <div className="w-full h-full flex">
              {scheduleFirst && persistentSlide && (
                <div style={{ width: `${gridSizePercent}%` }}>
                  <SlideTransition
                    slideKey={persistentSlide?.id || 'persistent'}
                    enabled={enableTransitions && (persistentInfo?.shouldRotate || false)}
                    duration={0.6}
                  >
                    <SlideRenderer
                      slide={persistentSlide}
                      onVideoEnded={() => persistentZone && onVideoEnded(persistentZone.id)}
                    />
                  </SlideTransition>
                </div>
              )}
              <div style={{ width: `${100 - gridSizePercent}%` }}>
                <SlideTransition
                  slideKey={mainSlide?.id || currentSlideIndex}
                  enabled={enableTransitions}
                  duration={0.6}
                >
                  <SlideRenderer
                    slide={mainSlide}
                    onVideoEnded={() => mainZone && onVideoEnded(mainZone.id)}
                  />
                </SlideTransition>
              </div>
              {!scheduleFirst && persistentSlide && (
                <div style={{ width: `${gridSizePercent}%` }}>
                  <SlideTransition
                    slideKey={persistentSlide?.id || 'persistent'}
                    enabled={enableTransitions && (persistentInfo?.shouldRotate || false)}
                    duration={0.6}
                  >
                    <SlideRenderer
                      slide={persistentSlide}
                      onVideoEnded={() => persistentZone && onVideoEnded(persistentZone.id)}
                    />
                  </SlideTransition>
                </div>
              )}
            </div>
          );
        } else {
          return (
            <div className="w-full h-full flex flex-col">
              {scheduleFirst && persistentSlide && (
                <div style={{ height: `${gridSizePercent}%` }}>
                  <SlideTransition
                    slideKey={persistentSlide?.id || 'persistent'}
                    enabled={enableTransitions && (persistentInfo?.shouldRotate || false)}
                    duration={0.6}
                  >
                    <SlideRenderer
                      slide={persistentSlide}
                      onVideoEnded={() => persistentZone && onVideoEnded(persistentZone.id)}
                    />
                  </SlideTransition>
                </div>
              )}
              <div style={{ height: `${100 - gridSizePercent}%` }}>
                <SlideTransition
                  slideKey={mainSlide?.id || currentSlideIndex}
                  enabled={enableTransitions}
                  duration={0.6}
                >
                  <SlideRenderer
                    slide={mainSlide}
                    onVideoEnded={() => mainZone && onVideoEnded(mainZone.id)}
                  />
                </SlideTransition>
              </div>
              {!scheduleFirst && persistentSlide && (
                <div style={{ height: `${gridSizePercent}%` }}>
                  <SlideTransition
                    slideKey={persistentSlide?.id || 'persistent'}
                    enabled={enableTransitions && (persistentInfo?.shouldRotate || false)}
                    duration={0.6}
                  >
                    <SlideRenderer
                      slide={persistentSlide}
                      onVideoEnded={() => persistentZone && onVideoEnded(persistentZone.id)}
                    />
                  </SlideTransition>
                </div>
              )}
            </div>
          );
        }

      case 'picture-in-picture':
        // Get zones for this layout
        const pipZones = zones.filter((z) => z.id === 'overlay' || z.id === 'main');
        const overlayZone = pipZones.find((z) => z.id === 'overlay');
        const pipMainZone = pipZones.find((z) => z.id === 'main');

        const overlaySlide = overlayZone ? getZoneSlide(overlayZone.id) : null;
        const pipMainSlide = pipMainZone ? getZoneSlide(pipMainZone.id) : currentSlide;

        return (
          <div className="w-full h-full relative">
            <SlideTransition
              slideKey={pipMainSlide?.id || 'main'}
              enabled={enableTransitions}
              duration={0.6}
            >
              <SlideRenderer
                slide={pipMainSlide}
                onVideoEnded={() => pipMainZone && onVideoEnded(pipMainZone.id)}
              />
            </SlideTransition>
            {overlaySlide && (
              <div className="absolute top-8 right-8 w-1/3 h-1/3 shadow-2xl rounded-lg overflow-hidden">
                <SlideTransition
                  slideKey={overlaySlide?.id || 'overlay'}
                  enabled={enableTransitions}
                  duration={0.6}
                >
                  <SlideRenderer
                    slide={overlaySlide}
                    onVideoEnded={() => overlayZone && onVideoEnded(overlayZone.id)}
                  />
                </SlideTransition>
              </div>
            )}
          </div>
        );

      case 'triple-view':
        // Get zones for this layout
        const tripleZones = zones.filter((z) => z.id === 'left' || z.id === 'top-right' || z.id === 'bottom-right');
        const leftZone = tripleZones.find((z) => z.id === 'left');
        const topRightZone = tripleZones.find((z) => z.id === 'top-right');
        const bottomRightZone = tripleZones.find((z) => z.id === 'bottom-right');

        const leftSlide = leftZone ? getZoneSlide(leftZone.id) : null;
        const topRightSlide = topRightZone ? getZoneSlide(topRightZone.id) : null;
        const bottomRightSlide = bottomRightZone ? getZoneSlide(bottomRightZone.id) : null;

        // Get sizes from zones
        const leftSize = leftZone?.size || 66;
        const topRightSize = topRightZone?.size || 50;

        // Get zone info to check if should rotate
        const leftInfo = leftZone ? getZoneInfo(leftZone.id) : null;
        const topRightInfo = topRightZone ? getZoneInfo(topRightZone.id) : null;
        const bottomRightInfo = bottomRightZone ? getZoneInfo(bottomRightZone.id) : null;

        return (
          <div className="w-full h-full flex">
            {/* Left Panel */}
            {leftSlide && (
              <div style={{ width: `${leftSize}%` }}>
                <SlideTransition
                  slideKey={leftSlide?.id || 'left'}
                  enabled={enableTransitions && (leftInfo?.shouldRotate || false)}
                  duration={0.6}
                >
                  {leftSlide.type === 'content-panel' ? (
                    <ScheduleGridSlide schedule={localSchedule} settings={localSettings} />
                  ) : (
                    <SlideRenderer
                      slide={leftSlide}
                      onVideoEnded={() => leftZone && onVideoEnded(leftZone.id)}
                    />
                  )}
                </SlideTransition>
              </div>
            )}

            {/* Right Panel - Split Top/Bottom */}
            <div style={{ width: `${100 - leftSize}%` }} className="flex flex-col">
              {/* Top Right */}
              {topRightSlide && (
                <div style={{ height: `${topRightSize}%` }}>
                  <SlideTransition
                    slideKey={topRightSlide?.id || `top-right-${topRightSlide?.saunaId || 0}`}
                    enabled={enableTransitions && (topRightInfo?.shouldRotate || false)}
                    duration={0.6}
                  >
                    {topRightSlide.type === 'sauna-detail' ? (
                      <SaunaDetailDashboard
                        schedule={localSchedule}
                        settings={localSettings}
                        saunaId={topRightSlide.saunaId}
                      />
                    ) : (
                      <SlideRenderer
                        slide={topRightSlide}
                        onVideoEnded={() => topRightZone && onVideoEnded(topRightZone.id)}
                      />
                    )}
                  </SlideTransition>
                </div>
              )}

              {/* Bottom Right */}
              {bottomRightSlide && (
                <div style={{ height: `${100 - topRightSize}%` }}>
                  <SlideTransition
                    slideKey={bottomRightSlide?.id || `bottom-right-${bottomRightSlide?.saunaId || 1}`}
                    enabled={enableTransitions && (bottomRightInfo?.shouldRotate || false)}
                    duration={0.6}
                  >
                    {bottomRightSlide.type === 'sauna-detail' ? (
                      <SaunaDetailDashboard
                        schedule={localSchedule}
                        settings={localSettings}
                        saunaId={bottomRightSlide.saunaId}
                      />
                    ) : (
                      <SlideRenderer
                        slide={bottomRightSlide}
                        onVideoEnded={() => bottomRightZone && onVideoEnded(bottomRightZone.id)}
                      />
                    )}
                  </SlideTransition>
                </div>
              )}
            </div>
          </div>
        );

      case 'carousel':
      case 'sidebar-left':
      case 'sidebar-right':
        // Similar to split-view
        return renderLayout(); // Fallback to split-view for now

      case 'grid-2x2':
      case 'grid-3x3':
        // Grid layouts would show multiple slides at once
        // For now, show single slide
        return (
          <SlideTransition
            slideKey={currentSlide?.id || currentSlideIndex}
            enabled={enableTransitions}
            duration={0.6}
          >
            <SlideRenderer slide={currentSlide} onVideoEnded={onVideoEnded} />
          </SlideTransition>
        );

      default:
        return (
          <SlideTransition
            slideKey={currentSlide?.id || currentSlideIndex}
            enabled={enableTransitions}
            duration={0.6}
          >
            <SlideRenderer slide={currentSlide} onVideoEnded={onVideoEnded} />
          </SlideTransition>
        );
    }
  };

  return (
    <div
      className="w-full h-screen overflow-hidden flex flex-col"
      style={{ backgroundColor: themeColors.dashboardBg || themeColors.bg }}
    >
      {/* Optional Header */}
      {headerSettings.enabled && (
        <DisplayHeader settings={headerSettings} theme={themeColors} />
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {renderLayout()}
      </div>

      {/* Slide Indicators */}
      {showSlideIndicators && totalSlides > 1 && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2 z-50">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div
              key={i}
              className={clsx(
                'w-3 h-3 rounded-full transition-all',
                i === currentSlideIndex
                  ? 'bg-white w-8'
                  : 'bg-white/40'
              )}
            />
          ))}
        </div>
      )}

      {/* Connection indicator (dev mode) */}
      {(import.meta as any).env?.DEV && (
        <div
          className="fixed top-4 right-4 px-3 py-2 rounded-lg text-xs font-mono z-50"
          style={{
            backgroundColor: isConnected ? '#10B981' : '#EF4444',
            color: 'white',
          }}
        >
          {isConnected ? '● Connected' : '● Disconnected'}
          {pairingInfo?.id && (
            <div className="text-xs opacity-75">ID: {pairingInfo.id.slice(0, 8)}</div>
          )}
          <div className="text-xs opacity-75 mt-1">
            Slide {currentSlideIndex + 1}/{totalSlides}
          </div>
          <div className="text-xs opacity-75">Layout: {layout}</div>
        </div>
      )}
    </div>
  );
}
