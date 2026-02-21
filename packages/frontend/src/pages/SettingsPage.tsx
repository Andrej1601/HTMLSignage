import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { TabGroup, TabPanel, type Tab } from '@/components/TabGroup';
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

  // useMemo MUST be called before any early returns to satisfy Rules of Hooks
  const tabs = useMemo<Tab<TabId>[]>(() => {
    const items: Tab<TabId>[] = [
      { id: 'theme', label: 'Farben & Design', icon: Palette },
      { id: 'audio', label: 'Audio', icon: Music },
      { id: 'aromas', label: 'Aromas', icon: Sparkles },
      { id: 'infos', label: 'Infos', icon: Info },
      { id: 'events', label: 'Events', icon: Calendar },
    ];
    if (isAdmin) {
      items.push({ id: 'system', label: 'System', icon: Wrench });
    }
    return items;
  }, [isAdmin]);

  if (isLoading) {
    return (
      <Layout>
        <LoadingSpinner label="Lade Einstellungen..." />
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

  return (
    <Layout>
      <div>
        <PageHeader
          title="Einstellungen"
          description="Design, Schriften, Audio, Events und Systemfunktionen zentral konfigurieren."
          icon={Wrench}
          actions={(
            <>
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
            </>
          )}
          badges={[
            { label: `Version ${localSettings.version}`, tone: 'info' },
            { label: isDirty ? 'Ungespeicherte Änderungen' : 'Alles gespeichert', tone: isDirty ? 'warning' : 'success' },
          ]}
        />

        <div className="mb-6">
          <TabGroup tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <TabPanel id="theme" activeTab={activeTab}>
            {localSettings.theme && (
              <ThemeEditor
                theme={localSettings.theme}
                designStyle={localSettings.designStyle}
                colorPalette={localSettings.colorPalette}
                onChange={handleThemeChange}
                onDesignStyleChange={handleDesignStyleChange}
                onColorPaletteChange={handleColorPaletteChange}
              />
            )}
          </TabPanel>

          <TabPanel id="audio" activeTab={activeTab}>
            {localSettings.audio && (
              <AudioSettings
                audio={localSettings.audio}
                onChange={handleAudioChange}
              />
            )}
          </TabPanel>

          <TabPanel id="aromas" activeTab={activeTab}>
            <AromaLibraryManager
              aromas={localSettings.aromas || []}
              onChange={handleAromasChange}
            />
          </TabPanel>

          <TabPanel id="infos" activeTab={activeTab}>
            <InfoManager
              infos={localSettings.infos || []}
              onChange={handleInfosChange}
            />
          </TabPanel>

          <TabPanel id="events" activeTab={activeTab}>
            <EventManager
              events={localSettings.events || []}
              onChange={handleEventsChange}
            />
          </TabPanel>

          <TabPanel id="system" activeTab={activeTab}>
            {isAdmin && <SystemMaintenance />}
          </TabPanel>
        </div>

        {/* Version Info */}
        <div className="mt-6 text-center text-sm text-spa-text-secondary">
          Version: {localSettings.version}
        </div>
      </div>
    </Layout>
  );
}
