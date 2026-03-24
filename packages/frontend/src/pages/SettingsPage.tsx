import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
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
import { AutosaveIndicator } from '@/components/AutosaveIndicator';
import { useCommandPaletteActions } from '@/hooks/useCommandPaletteActions';
import { Button } from '@/components/Button';
import { SectionCard } from '@/components/SectionCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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

  const unsavedGuard = useUnsavedChangesGuard({
    when: isDirty,
  });

  useEffect(() => {
    if (!settings || isDirty || draftState.hasStoredDraft) return;
    setLocalSettings(settings);
    setIsDirty(false);
  }, [draftState.hasStoredDraft, isDirty, settings]);

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

  const paletteActions = useMemo(() => isDirty ? [
    { id: 'settings-save', label: 'Einstellungen speichern', description: 'Ungespeicherte Änderungen sichern', icon: Save, group: 'Aktionen', action: handleSave },
  ] : [], [isDirty, handleSave]);
  useCommandPaletteActions(paletteActions);

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

  const tabGroups = useMemo(() => {
    const groups: Array<{ label: string; tabs: Tab<TabId>[] }> = [
      { label: 'Darstellung', tabs: tabs.filter(t => t.id === 'theme' || t.id === 'maintenance') },
      { label: 'Inhalte', tabs: tabs.filter(t => t.id === 'aromas' || t.id === 'infos' || t.id === 'events') },
      { label: 'System', tabs: tabs.filter(t => t.id === 'audio' || t.id === 'system') },
    ];
    return groups.filter(g => g.tabs.length > 0);
  }, [tabs]);

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="h-20 animate-pulse rounded-2xl bg-spa-bg-secondary" />
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="rect" className="h-10 w-28 rounded-lg" />)}
          </div>
          <SkeletonCard />
          <SkeletonCard />
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

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Einstellungen"
          description="Design, Schriften, Audio, Events und Systemfunktionen zentral konfigurieren."
          icon={Wrench}
          actions={(
            <>
              <AutosaveIndicator isDirty={isDirty} lastAutoSavedAt={draftState.lastAutoSavedAt} />
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
            draftState.hasStoredDraft && !isDirty
              ? { label: 'Lokaler Entwurf vorhanden', tone: 'warning' as const }
              : { label: 'Live-Stand', tone: 'neutral' as const },
            { label: isDirty ? 'Ungespeicherte Änderungen' : 'Alles gespeichert', tone: isDirty ? 'warning' : 'success' },
          ]}
        />

        {draftState.hasStoredDraft && !isDirty && (
          <DraftRecoveryBanner
            entityLabel="Einstellungen"
            updatedAt={draftState.draftUpdatedAt}
            onRestore={handleRestoreDraft}
            onDiscard={handleDiscardDraft}
          />
        )}

        {/* Mobile: horizontal tabs */}
        <div className="xl:hidden">
          <TabGroup tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <div className="flex gap-6">
          {/* Desktop: vertical grouped sidebar */}
          <nav className="hidden xl:block w-56 flex-shrink-0" aria-label="Einstellungen-Navigation">
            <div className="sticky top-4 space-y-4">
              {tabGroups.map((group) => (
                <div key={group.label}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-spa-text-secondary/70 px-3 mb-1">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.tabs.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-spa-primary text-white shadow-sm'
                              : 'text-spa-text-secondary hover:bg-spa-bg-primary hover:text-spa-text-primary'
                          }`}
                        >
                          {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          {/* Content */}
          <SectionCard noPadding className="flex-1 min-w-0">
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
        </div>

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

      <ConfirmDialog
        isOpen={unsavedGuard.isBlocked}
        title="Ungespeicherte Änderungen"
        message="Es gibt ungespeicherte Änderungen in den Einstellungen. Wirklich verlassen?"
        confirmLabel="Verlassen"
        cancelLabel="Bleiben"
        variant="warning"
        onConfirm={unsavedGuard.proceed}
        onCancel={unsavedGuard.reset}
      />
    </Layout>
  );
}
