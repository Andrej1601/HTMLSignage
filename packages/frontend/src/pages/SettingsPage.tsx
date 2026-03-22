import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { TabGroup, TabPanel, type Tab } from '@/components/TabGroup';
import { useSettings } from '@/hooks/useSettings';
import { useSchedule } from '@/hooks/useSchedule';
import { usePersistentEditorDraft } from '@/hooks/usePersistentEditorDraft';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { ThemeEditor } from '@/components/Settings/ThemeEditor';
import { AudioSettings } from '@/components/Settings/AudioSettings';
import { AromaLibraryManager } from '@/components/Settings/AromaLibraryManager';
import { InfoManager } from '@/components/Settings/InfoManager';
import { MaintenanceScreenEditor } from '@/components/Settings/MaintenanceScreenEditor';
import { usePermission } from '@/hooks/usePermission';

const EventManager = lazy(() => import('@/components/Settings/EventManager').then(m => ({ default: m.EventManager })));
const SystemMaintenance = lazy(() => import('@/components/Settings/SystemMaintenance').then(m => ({ default: m.SystemMaintenance })));
const DisplayScenarioPreview = lazy(() => import('@/components/Display/DisplayScenarioPreview').then(m => ({ default: m.DisplayScenarioPreview })));
import { useAuth } from '@/contexts/AuthContext';
import { createDefaultSchedule } from '@/types/schedule.types';
import { generateDashboardColors, getColorPalette, getDefaultSettings } from '@/types/settings.types';
import type {
  Settings,
  ColorPaletteName,
} from '@/types/settings.types';
import { Save, RotateCcw, Palette, Music, Sparkles, Calendar, Info, Monitor, Wrench } from 'lucide-react';
import { Button } from '@/components/Button';
import { SectionCard } from '@/components/SectionCard';
import { DraftRecoveryBanner } from '@/components/DraftRecoveryBanner';

type TabId = 'theme' | 'audio' | 'maintenance' | 'aromas' | 'infos' | 'events' | 'system';

export function SettingsPage() {
  const { user } = useAuth();
  const { settings, isLoading, save, isSaving, refetch } = useSettings();
  const { schedule } = useSchedule();
  const canSystem = usePermission('system:manage');
  const [activeTab, setActiveTab] = useState<TabId>('theme');
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const draftStorageKey = `htmlsignage_editor_draft_settings_${user?.id || 'anonymous'}`;

  const draftState = usePersistentEditorDraft<Settings, { activeTab: TabId }>({
    storageKey: draftStorageKey,
    value: localSettings,
    meta: { activeTab },
    isDirty,
    enabled: Boolean(localSettings),
  });

  useUnsavedChangesGuard({
    when: isDirty,
    message: 'Es gibt ungespeicherte Änderungen in den Einstellungen. Wirklich verlassen?',
  });

  useEffect(() => {
    if (!settings || isDirty || draftState.hasRecoveredDraft) return;
    setLocalSettings(settings);
    setIsDirty(false);
  }, [draftState.hasRecoveredDraft, isDirty, settings]);

  const updateField = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setLocalSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setIsDirty(true);
  };

  const handleColorPaletteChange = (colorPalette: ColorPaletteName) => {
    const paletteTheme = generateDashboardColors(getColorPalette(colorPalette));
    setLocalSettings((prev) => (prev ? { ...prev, colorPalette, theme: paletteTheme } : prev));
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!localSettings) return;

    const settingsToSave = {
      ...localSettings,
      version: (localSettings.version || 1) + 1,
    };

    save(settingsToSave, {
      onSuccess: () => {
        draftState.clearDraft();
        setIsDirty(false);
      },
    });
  };

  const handleReload = () => {
    draftState.clearDraft();
    if (settings) {
      setLocalSettings(settings);
    }
    refetch();
    setIsDirty(false);
  };

  const handleRestoreDraft = () => {
    const restored = draftState.restoreDraft();
    if (!restored) return;

    setLocalSettings(restored.value);
    if (restored.meta?.activeTab && tabs.some((tab) => tab.id === restored.meta?.activeTab)) {
      setActiveTab(restored.meta.activeTab);
    }
    setIsDirty(true);
  };

  const handleDiscardDraft = () => {
    draftState.clearDraft();
    if (settings) {
      setLocalSettings(settings);
    }
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
      { id: 'maintenance', label: 'Wartungsscreen', icon: Monitor },
      { id: 'aromas', label: 'Aromas', icon: Sparkles },
      { id: 'infos', label: 'Infos', icon: Info },
      { id: 'events', label: 'Events', icon: Calendar },
    ];
    if (canSystem) {
      items.push({ id: 'system', label: 'System', icon: Wrench });
    }
    return items;
  }, [canSystem]);

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
      <div className="space-y-6">
        <PageHeader
          title="Einstellungen"
          description="Design, Schriften, Audio, Events und Systemfunktionen zentral konfigurieren."
          icon={Wrench}
          actions={(
            <>
              <Button variant="ghost" icon={RotateCcw} onClick={handleReload} disabled={isSaving}>
                Neu laden
              </Button>
              <Button variant="secondary" onClick={handleReset} disabled={isSaving}>
                Zurücksetzen
              </Button>
              <Button icon={Save} onClick={handleSave} disabled={!isDirty} loading={isSaving} loadingText="Speichert...">
                Speichern
              </Button>
            </>
          )}
          badges={[
            { label: `Live v${settings?.version || localSettings.version}`, tone: 'info' },
            draftState.hasStoredDraft
              ? {
                  label: draftState.hasRecoveredDraft ? 'Entwurf wiederhergestellt' : 'Lokaler Entwurf vorhanden',
                  tone: draftState.hasRecoveredDraft ? 'info' as const : 'warning' as const,
                }
              : { label: 'Live-Stand', tone: 'neutral' as const },
            { label: isDirty ? 'Ungespeicherte Änderungen' : 'Alles gespeichert', tone: isDirty ? 'warning' : 'success' },
          ]}
        />

        {draftState.hasStoredDraft && !draftState.hasRecoveredDraft && !isDirty && (
          <DraftRecoveryBanner
            mode="available"
            entityLabel="Einstellungen"
            updatedAt={draftState.draftUpdatedAt}
            onRestore={handleRestoreDraft}
            onDiscard={handleDiscardDraft}
          />
        )}

        {draftState.hasRecoveredDraft && (
          <DraftRecoveryBanner
            mode="restored"
            entityLabel="Einstellungen"
            updatedAt={draftState.draftUpdatedAt}
            onDiscard={handleDiscardDraft}
          />
        )}

        <TabGroup tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <SectionCard noPadding>
          <div className="p-6">
            <TabPanel id="theme" activeTab={activeTab}>
              {localSettings.theme && (
                <ThemeEditor
                  theme={localSettings.theme}
                  displayAppearance={localSettings.displayAppearance}
                  designStyle={localSettings.designStyle}
                  colorPalette={localSettings.colorPalette}
                  onChange={(theme) => updateField('theme', theme)}
                  onDisplayAppearanceChange={(v) => updateField('displayAppearance', v)}
                  onDesignStyleChange={(v) => updateField('designStyle', v)}
                  onColorPaletteChange={handleColorPaletteChange}
                />
              )}
            </TabPanel>

            <TabPanel id="audio" activeTab={activeTab}>
              {localSettings.audio && (
                <AudioSettings
                  audio={localSettings.audio}
                  onChange={(audio) => updateField('audio', audio)}
                />
              )}
            </TabPanel>

            <TabPanel id="maintenance" activeTab={activeTab}>
              <MaintenanceScreenEditor
                value={localSettings.maintenanceScreen}
                onChange={(v) => updateField('maintenanceScreen', v)}
              />
            </TabPanel>

            <TabPanel id="aromas" activeTab={activeTab}>
              <AromaLibraryManager
                aromas={localSettings.aromas || []}
                onChange={(aromas) => updateField('aromas', aromas)}
              />
            </TabPanel>

            <TabPanel id="infos" activeTab={activeTab}>
              <InfoManager
                infos={localSettings.infos || []}
                onChange={(infos) => updateField('infos', infos)}
              />
            </TabPanel>

            <TabPanel id="events" activeTab={activeTab}>
              <Suspense fallback={<LoadingSpinner label="Lade Event-Manager..." />}>
                <EventManager
                  events={localSettings.events || []}
                  settings={localSettings}
                  schedule={schedule}
                  onChange={(events) => updateField('events', events)}
                />
              </Suspense>
            </TabPanel>

            <TabPanel id="system" activeTab={activeTab}>
              {canSystem && (
                <Suspense fallback={<LoadingSpinner label="Lade Systemwartung..." />}>
                  <SystemMaintenance />
                </Suspense>
              )}
            </TabPanel>
          </div>
        </SectionCard>

        <SectionCard
          title="Szenario-Vorschau"
          description="Ungespeicherte Einstellungen direkt über den echten Display-Pfad für Gerät, Uhrzeit und Event-Kontext prüfen."
          icon={Monitor}
        >
          <Suspense fallback={<LoadingSpinner label="Lade Vorschau..." />}>
            <DisplayScenarioPreview
              schedule={schedule || createDefaultSchedule()}
              settings={localSettings}
            />
          </Suspense>
        </SectionCard>
      </div>
    </Layout>
  );
}
