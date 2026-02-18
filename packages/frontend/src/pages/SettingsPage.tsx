import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useSettings } from '@/hooks/useSettings';
import { ThemeEditor } from '@/components/Settings/ThemeEditor';
import { AudioSettings } from '@/components/Settings/AudioSettings';
import { AromaLibraryManager } from '@/components/Settings/AromaLibraryManager';
import { InfoManager } from '@/components/Settings/InfoManager';
import { EventManager } from '@/components/Settings/EventManager';
import { SystemMaintenance } from '@/components/Settings/SystemMaintenance';
import { useAuth } from '@/contexts/AuthContext';
import { generateDashboardColors, getColorPalette, getDefaultSettings } from '@/types/settings.types';
import type {
  Settings,
  ThemeColors,
  AudioSettings as AudioSettingsType,
  Aroma,
  Event,
  InfoItem,
  DesignStyle,
  ColorPaletteName,
} from '@/types/settings.types';
import { Save, RotateCcw, Palette, Music, Sparkles, Calendar, Info, Wrench } from 'lucide-react';

type TabId = 'theme' | 'audio' | 'aromas' | 'infos' | 'events' | 'system';

export function SettingsPage() {
  const { settings, isLoading, save, isSaving, refetch } = useSettings();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('theme');
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const isAdmin = Boolean(user?.roles.includes('admin'));

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
      setIsDirty(false);
    }
  }, [settings]);

  const handleThemeChange = (theme: ThemeColors) => {
    setLocalSettings((prev) => (prev ? { ...prev, theme } : prev));
    setIsDirty(true);
  };

  const handleDesignStyleChange = (designStyle: DesignStyle) => {
    setLocalSettings((prev) => (prev ? { ...prev, designStyle } : prev));
    setIsDirty(true);
  };

  const handleColorPaletteChange = (colorPalette: ColorPaletteName) => {
    const paletteTheme = generateDashboardColors(getColorPalette(colorPalette));
    setLocalSettings((prev) => (prev ? { ...prev, colorPalette, theme: paletteTheme } : prev));
    setIsDirty(true);
  };

  const handleAudioChange = (audio: AudioSettingsType) => {
    setLocalSettings((prev) => (prev ? { ...prev, audio } : prev));
    setIsDirty(true);
  };

  const handleAromasChange = (aromas: Aroma[]) => {
    setLocalSettings((prev) => (prev ? { ...prev, aromas } : prev));
    setIsDirty(true);
  };

  const handleInfosChange = (infos: InfoItem[]) => {
    setLocalSettings((prev) => (prev ? { ...prev, infos } : prev));
    setIsDirty(true);
  };

  const handleEventsChange = (events: Event[]) => {
    setLocalSettings((prev) => (prev ? { ...prev, events } : prev));
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!localSettings) return;

    const settingsToSave = {
      ...localSettings,
      version: (localSettings.version || 1) + 1,
    };

    save(settingsToSave);
    setIsDirty(false);
  };

  const handleReload = () => {
    refetch();
    setIsDirty(false);
  };

  const handleReset = () => {
    const defaults = getDefaultSettings();
    // IMPORTANT: Preserve saunas, slideshow, aromas, infos, and events from current settings
    // Only reset theme, fonts, slides, display, and audio
    setLocalSettings({
      ...defaults,
      saunas: localSettings?.saunas,
      slideshow: localSettings?.slideshow,
      aromas: localSettings?.aromas || defaults.aromas,
      infos: localSettings?.infos || defaults.infos,
      events: localSettings?.events || defaults.events,
    });
    setIsDirty(true);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-spa-text-secondary">Lade Einstellungen...</div>
        </div>
      </Layout>
    );
  }

  if (!localSettings) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-spa-text-secondary">Keine Einstellungen verfügbar</div>
        </div>
      </Layout>
    );
  }

  const tabs = [
    { id: 'theme' as TabId, label: 'Farben & Design', icon: Palette },
    { id: 'audio' as TabId, label: 'Audio', icon: Music },
    { id: 'aromas' as TabId, label: 'Aromas', icon: Sparkles },
    { id: 'infos' as TabId, label: 'Infos', icon: Info },
    { id: 'events' as TabId, label: 'Events', icon: Calendar },
  ];
  if (isAdmin) {
    tabs.push({ id: 'system' as TabId, label: 'System', icon: Wrench });
  }

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-spa-text-primary mb-2">Einstellungen</h2>
              <p className="text-spa-text-secondary">Design, Schriften und Audio konfigurieren</p>
            </div>

            <div className="flex items-center gap-3">
              {isDirty && (
                <span className="text-sm text-spa-accent font-medium">
                  Nicht gespeicherte Änderungen
                </span>
              )}
              <button
                onClick={handleReload}
                disabled={isSaving}
                className="px-4 py-2 bg-spa-bg-secondary text-spa-text-primary rounded-lg hover:bg-spa-secondary/20 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                Neu laden
              </button>
              <button
                onClick={handleReset}
                disabled={isSaving}
                className="px-4 py-2 bg-spa-bg-secondary text-spa-text-primary rounded-lg hover:bg-spa-secondary/20 transition-colors disabled:opacity-50"
              >
                Zurücksetzen
              </button>
              <button
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className="px-6 py-2 bg-spa-primary text-white rounded-lg hover:bg-spa-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b border-spa-bg-secondary">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                    activeTab === tab.id
                      ? 'text-spa-primary border-b-2 border-spa-primary'
                      : 'text-spa-text-secondary hover:text-spa-text-primary'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'theme' && localSettings.theme && (
            <ThemeEditor
              theme={localSettings.theme}
              designStyle={localSettings.designStyle}
              colorPalette={localSettings.colorPalette}
              onChange={handleThemeChange}
              onDesignStyleChange={handleDesignStyleChange}
              onColorPaletteChange={handleColorPaletteChange}
            />
          )}

          {activeTab === 'audio' && localSettings.audio && (
            <AudioSettings
              audio={localSettings.audio}
              onChange={handleAudioChange}
            />
          )}

          {activeTab === 'aromas' && (
            <AromaLibraryManager
              aromas={localSettings.aromas || []}
              onChange={handleAromasChange}
            />
          )}

          {activeTab === 'infos' && (
            <InfoManager
              infos={localSettings.infos || []}
              onChange={handleInfosChange}
            />
          )}

          {activeTab === 'events' && (
            <EventManager
              events={localSettings.events || []}
              onChange={handleEventsChange}
            />
          )}

          {activeTab === 'system' && isAdmin && (
            <SystemMaintenance />
          )}
        </div>

        {/* Version Info */}
        <div className="mt-6 text-center text-sm text-spa-text-secondary">
          Version: {localSettings.version}
        </div>
      </div>
    </Layout>
  );
}
