import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSchedule } from '@/hooks/useSchedule';
import { useSettings } from '@/hooks/useSettings';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useSlideshow } from '@/hooks/useSlideshow';
import { OverviewSlide } from '@/components/Display/OverviewSlide';
import { ClockSlide } from '@/components/Display/ClockSlide';
import { devicesApi } from '@/services/api';
import { getDefaultSettings } from '@/types/settings.types';

export function DisplayClientPage() {
  const [searchParams] = useSearchParams();
  const deviceId = searchParams.get('deviceId') || 'demo';

  const { schedule, isLoading: scheduleLoading } = useSchedule();
  const { settings: fetchedSettings, isLoading: settingsLoading } = useSettings();

  const [localSchedule, setLocalSchedule] = useState(schedule);
  const [localSettings, setLocalSettings] = useState(fetchedSettings || getDefaultSettings());

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

  // Subscribe to updates once connected
  useEffect(() => {
    if (isConnected) {
      subscribe('schedule');
      subscribe('settings');
      subscribe('device', deviceId);
    }
  }, [isConnected, subscribe, deviceId]);

  // Heartbeat system
  useEffect(() => {
    if (!deviceId || deviceId === 'demo') return;

    const sendHeartbeat = async () => {
      try {
        await devicesApi.sendHeartbeat(deviceId);
        console.log('[Display] Heartbeat sent');
      } catch (error) {
        console.error('[Display] Heartbeat failed:', error);
      }
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Send heartbeat every 2 minutes
    const interval = setInterval(sendHeartbeat, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [deviceId]);

  // Slideshow
  const { currentSlide } = useSlideshow({
    settings: localSettings,
    enabled: true,
  });

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

  // Render current slide
  return (
    <div className="w-full h-screen overflow-hidden">
      {currentSlide === 'overview' && (
        <OverviewSlide schedule={localSchedule} settings={localSettings} />
      )}

      {currentSlide === 'clock' && (
        <ClockSlide settings={localSettings} />
      )}

      {/* Connection indicator (dev mode) */}
      {process.env.NODE_ENV === 'development' && (
        <div
          className="fixed bottom-4 right-4 px-3 py-2 rounded-lg text-xs font-mono"
          style={{
            backgroundColor: isConnected ? '#10B981' : '#EF4444',
            color: 'white',
          }}
        >
          {isConnected ? '● Connected' : '● Disconnected'}
          {deviceId !== 'demo' && (
            <div className="text-xs opacity-75">ID: {deviceId.slice(0, 8)}</div>
          )}
        </div>
      )}
    </div>
  );
}
