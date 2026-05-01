import { lazy, Suspense, useCallback, useState, useMemo } from 'react';
import { toast } from '@/stores/toastStore';
import { useSaveShortcut } from '@/hooks/useSaveShortcut';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
import { PageHeader } from '@/components/PageHeader';
import { TabGroup, TabPanel, type Tab } from '@/components/TabGroup';
import { useSettings } from '@/hooks/useSettings';
import { useSchedule } from '@/hooks/useSchedule';
import { usePersistentEditorDraft } from '@/hooks/usePersistentEditorDraft';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ThemeEditor } from '@/components/Settings/ThemeEditor';
import { useSlideshows } from '@/hooks/useSlideshows';
import { AudioSettings } from '@/components/Settings/AudioSettings';
import { AromaLibraryManager } from '@/components/Settings/AromaLibraryManager';
import { InfoManager } from '@/components/Settings/InfoManager';
import { MaintenanceScreenEditor } from '@/components/Settings/MaintenanceScreenEditor';
import { HeaderSettingsEditor } from '@/components/Settings/HeaderSettingsEditor';
import { DesignHealthCard } from '@/components/Settings/DesignHealthCard';
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
import {
  buildSlideshowPreviewPayload,
  resolvePreviewSlideshow,
} from '@/pages/slideshowPage.utils';
import { Save, RotateCcw, Palette, Music, Sparkles, Calendar, Info, Monitor, Wrench } from 'lucide-react';
import { AutosaveIndicator } from '@/components/AutosaveIndicator';
import { useCommandPaletteActions } from '@/hooks/useCommandPaletteActions';
import { Button } from '@/components/Button';
import { SectionCard } from '@/components/SectionCard';
import { DraftRecoveryBanner } from '@/components/DraftRecoveryBanner';
import { StaleVersionBanner } from '@/components/StaleVersionBanner';
import { VersionConflictDialog } from '@/components/VersionConflictDialog';
import { extractVersionConflict } from '@/utils/versionConflict';

type TabId = 'theme' | 'audio' | 'maintenance' | 'aromas' | 'infos' | 'events' | 'system';

export function SettingsPage() {
  const { user } = useAuth();
  const { settings, isLoading, save, isSaving, refetch } = useSettings();
  const { schedule } = useSchedule();
  const canSystem = usePermission('system:manage');
  const [activeTab, setActiveTab] = useState<TabId>('theme');
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [previewSlideshowId, setPreviewSlideshowId] = useState<string | null>(null);
  const { data: allSlideshows = [] } = useSlideshows();

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

  // Tab-switch guard: show confirm dialog instead of silently blocking
  const [pendingTab, setPendingTab] = useState<TabId | null>(null);
  const handleTabChange = (tab: TabId) => {
    if (isDirty) {
      setPendingTab(tab);
    } else {
      setActiveTab(tab);
    }
  };

  const [prevSettingsVersion, setPrevSettingsVersion] = useState<number | null>(null);
  const [staleDismissedForVersion, setStaleDismissedForVersion] = useState<number | null>(null);
  const settingsVersion = settings?.version ?? null;
  if (settingsVersion !== prevSettingsVersion && settings && !isDirty && !draftState.hasStoredDraft) {
    setPrevSettingsVersion(settingsVersion);
    setLocalSettings(settings);
    setIsDirty(false);
  }

  // Stale-Detection: anderer Admin hat parallel gespeichert, während wir
  // dirty sind. `prevSettingsVersion` ist immer der zuletzt geladene
  // Server-Stand, `localSettings.version` der Bearbeitungs-Stand.
  const localVersion = localSettings?.version ?? null;
  const isStale =
    isDirty &&
    typeof settingsVersion === 'number' &&
    typeof localVersion === 'number' &&
    settingsVersion > localVersion &&
    staleDismissedForVersion !== settingsVersion;

  // Versionskonflikt-State: wird gefüllt, sobald `save` mit 409 abgelehnt
  // wurde. Der Dialog bleibt offen, bis der User aktiv eine Lösung wählt.
  const [conflictInfo, setConflictInfo] = useState<{ latestVersion: number | null } | null>(null);
  const [isForcingSave, setIsForcingSave] = useState(false);

  // Liste der grob geänderten Bereiche — für die Anzeige im Dialog,
  // damit der User sieht, was er gleich verlieren würde, falls er den
  // Server-Stand übernimmt. Heuristik: Vergleich der Top-Level-Keys
  // zwischen Live- und Local-Settings via JSON-Stringify.
  const changedAreas = useMemo<string[]>(() => {
    if (!settings || !localSettings) return [];
    const labels: Record<string, string> = {
      theme: 'Farben & Theme',
      colorPalette: 'Farbpalette',
      designStyle: 'Design-Stil',
      displayAppearance: 'Display-Erscheinung',
      display: 'Display-Settings',
      audio: 'Audio',
      saunas: 'Saunen',
      aromas: 'Aromen',
      infos: 'Infos',
      events: 'Events',
      header: 'Kopfzeile',
      maintenanceScreen: 'Wartungsscreen',
      saunaDetailStyle: 'Sauna-Detail-Style',
    };
    const result: string[] = [];
    const serverRecord = settings as unknown as Record<string, unknown>;
    const localRecord = localSettings as unknown as Record<string, unknown>;
    for (const [key, label] of Object.entries(labels)) {
      const a = serverRecord[key];
      const b = localRecord[key];
      if (JSON.stringify(a) !== JSON.stringify(b)) result.push(label);
    }
    return result;
  }, [settings, localSettings]);

  const updateField = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setLocalSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setIsDirty(true);
  };

  const handleColorPaletteChange = (colorPalette: ColorPaletteName) => {
    const paletteTheme = generateDashboardColors(getColorPalette(colorPalette));
    setLocalSettings((prev) => (prev ? { ...prev, colorPalette, theme: paletteTheme } : prev));
    setIsDirty(true);
  };

  const handleSave = useCallback(() => {
    if (!localSettings) return;

    const settingsToSave = {
      ...localSettings,
      version: (localSettings.version || 1) + 1,
    };

    save(settingsToSave, {
      onSuccess: (response) => {
        draftState.clearDraft();
        setIsDirty(false);
        toast.success(`Einstellungen gespeichert (v${response?.version ?? settingsToSave.version}).`);
      },
      onError: (err) => {
        const conflict = extractVersionConflict(err);
        if (conflict) {
          // 409 → reichhaltigen Dialog statt Toast
          setConflictInfo({ latestVersion: conflict.latestVersion });
          return;
        }
        toast.error(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
      },
    });
  }, [localSettings, save, draftState]);

  // "Server-Stand übernehmen": lokale Änderungen verwerfen, Live-Daten
  // laden — die useSettings-Query wird via refetch() aktualisiert.
  const handleAcceptServer = useCallback(() => {
    setConflictInfo(null);
    draftState.clearDraft();
    setIsDirty(false);
    if (settings) {
      setLocalSettings(settings);
      setPrevSettingsVersion(settings.version ?? null);
    }
    refetch();
    setStaleDismissedForVersion(null);
    toast.info('Server-Stand übernommen. Lokale Änderungen wurden verworfen.');
  }, [settings, refetch, draftState]);

  // "Erzwingen": baut den Save erneut, diesmal mit `latestVersion + 1`
  // als Versionsfeld. Damit überschreibt der User bewusst die parallele
  // Server-Änderung.
  const handleForceSave = useCallback(() => {
    if (!localSettings || !conflictInfo?.latestVersion) return;
    setIsForcingSave(true);
    const forced = {
      ...localSettings,
      version: conflictInfo.latestVersion + 1,
    };
    save(forced, {
      onSuccess: (response) => {
        setIsForcingSave(false);
        setConflictInfo(null);
        draftState.clearDraft();
        setIsDirty(false);
        // Lokale Versionsnummer hochziehen, damit die Stale-Erkennung
        // nicht sofort wieder anschlägt.
        setLocalSettings((prev) => prev ? { ...prev, version: response?.version ?? forced.version } : prev);
        setPrevSettingsVersion(response?.version ?? forced.version);
        toast.success(`Einstellungen erzwungen gespeichert (v${response?.version ?? forced.version}).`);
      },
      onError: (err) => {
        setIsForcingSave(false);
        // Bei erneuten 409 (sehr unwahrscheinlich): Dialog mit neuer
        // latestVersion aktualisieren statt zu schließen.
        const conflict = extractVersionConflict(err);
        if (conflict) {
          setConflictInfo({ latestVersion: conflict.latestVersion });
          toast.warning('Während des Erzwingens hat jemand erneut gespeichert.');
          return;
        }
        toast.error(err instanceof Error ? err.message : 'Erzwingen fehlgeschlagen.');
      },
    });
  }, [localSettings, conflictInfo, save, draftState]);

  useSaveShortcut(handleSave, { enabled: !isSaving, isDirty });

  const handleReload = () => {
    draftState.clearDraft();
    if (settings) {
      setLocalSettings(settings);
      setPrevSettingsVersion(settings.version ?? null);
    }
    refetch();
    setIsDirty(false);
    setStaleDismissedForVersion(null);
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

  // Settings + schedule passed into the embedded preview. Memoised so
  // the preview iframe doesn't get bombarded with new settings refs on
  // every parent render — that previously reset slide rotation timers
  // and made deletions look like they "didn't take effect" because the
  // iframe kept re-mounting / re-applying the latest settings.
  const previewSchedule = useMemo(
    () => schedule || createDefaultSchedule(),
    [schedule],
  );
  const previewSettings = useMemo<Settings | null>(() => {
    if (!localSettings) return null;
    // When the ThemeEditor is scoped to a specific slideshow, flatten
    // that slideshow's design overrides onto the local settings —
    // matches the Slideshow-Page preview and the live client's
    // resolution logic. Otherwise render the globals as-is.
    if (previewSlideshowId) {
      const show = resolvePreviewSlideshow(allSlideshows, previewSlideshowId);
      if (show?.config) {
        const payload = buildSlideshowPreviewPayload({
          settings: localSettings,
          previewSchedule,
          editorConfig: show.config,
          editorPrestartMinutes: localSettings.display?.prestartMinutes ?? 10,
          isDirty: false,
        });
        if (payload?.settings) return payload.settings;
      }
    }
    return localSettings;
  }, [localSettings, previewSlideshowId, allSlideshows, previewSchedule]);

  const tabs: Tab<TabId>[] = [
    { id: 'theme', label: 'Farben & Design', icon: Palette },
    { id: 'audio', label: 'Audio', icon: Music },
    { id: 'maintenance', label: 'Wartungsscreen', icon: Monitor },
    { id: 'aromas', label: 'Aromas', icon: Sparkles },
    { id: 'infos', label: 'Infos', icon: Info },
    { id: 'events', label: 'Events', icon: Calendar },
    ...(canSystem ? [{ id: 'system' as const, label: 'System', icon: Wrench }] : []),
  ];

  const tabGroups: Array<{ label: string; tabs: Tab<TabId>[] }> = [
    { label: 'Darstellung', tabs: tabs.filter(t => t.id === 'theme' || t.id === 'maintenance') },
    { label: 'Inhalte', tabs: tabs.filter(t => t.id === 'aromas' || t.id === 'infos' || t.id === 'events') },
    { label: 'System', tabs: tabs.filter(t => t.id === 'audio' || t.id === 'system') },
  ].filter(g => g.tabs.length > 0);

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="h-20 animate-pulse rounded-2xl bg-spa-bg-secondary" />
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={`skeleton-${i}`} variant="rect" className="h-10 w-28 rounded-lg" />)}
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

        {isStale && (
          <StaleVersionBanner
            entityLabel="Einstellungen"
            serverVersion={settingsVersion}
            localVersion={localVersion}
            onReload={handleReload}
            onDismiss={() => setStaleDismissedForVersion(settingsVersion)}
          />
        )}

        {/* Mobile: horizontal tabs */}
        <div className="xl:hidden">
          <TabGroup tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
        </div>

        <div className="flex gap-6">
          {/* Desktop: vertical grouped sidebar */}
          <nav className="hidden xl:block w-56 shrink-0" aria-label="Einstellungen-Navigation">
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
                          onClick={() => handleTabChange(tab.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-spa-primary text-white shadow-xs'
                              : 'text-spa-text-secondary hover:bg-spa-bg-primary hover:text-spa-text-primary'
                          }`}
                        >
                          {Icon && <Icon className="w-4 h-4 shrink-0" />}
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
                    saunaDetailStyle={localSettings.saunaDetailStyle}
                    colorPalette={localSettings.colorPalette}
                    maintenanceScreen={localSettings.maintenanceScreen}
                    display={localSettings.display}
                    onChange={(theme) => updateField('theme', theme)}
                    onDisplayAppearanceChange={(v) => {
                      updateField('displayAppearance', v);
                      // Auto-select the matching palette so the appearance
                      // looks correct out of the box. Each appearance has
                      // a hand-tuned palette whose ThemeColors translate
                      // cleanly to the pack's tokens via `themeBridge`.
                      if (v === 'aurora-thermal') handleColorPaletteChange('aurora-thermal');
                      else if (v === 'mineral-noir') handleColorPaletteChange('mineral-noir');
                      else if (v === 'wellness-stage') handleColorPaletteChange('wellness-warm');
                    }}
                    onDesignStyleChange={(v) => updateField('designStyle', v)}
                    onSaunaDetailStyleChange={(v) => updateField('saunaDetailStyle', v)}
                    onColorPaletteChange={handleColorPaletteChange}
                    onDisplayChange={(display) => updateField('display', display)}
                    onSlideshowContextChange={setPreviewSlideshowId}
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
                  <div className="space-y-4">
                    {/* Header / Kopfzeile — edited globally here. Per-
                        slideshow overrides still live on the
                        `config.header` field and are cleared via the
                        "Alle Overrides entfernen" button in the
                        colours-and-design tab. */}
                    <HeaderSettingsEditor
                      value={localSettings.header ?? getDefaultSettings().header!}
                      onChange={(next) => updateField('header', next)}
                      scopeLabel="Global"
                    />
                    <DesignHealthCard />
                    <Suspense fallback={<LoadingSpinner label="Lade Systemwartung..." />}>
                      <SystemMaintenance />
                    </Suspense>
                  </div>
                )}
              </TabPanel>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Szenario-Vorschau"
          description="Ungespeicherte Einstellungen direkt für Gerät, Zeitpunkt und Event-Kontext prüfen."
          icon={Monitor}
        >
          <Suspense fallback={<LoadingSpinner label="Lade Vorschau..." />}>
            {previewSettings ? (
              <DisplayScenarioPreview
                schedule={previewSchedule}
                settings={previewSettings}
              />
            ) : null}
          </Suspense>
        </SectionCard>
      </div>

      {/* Route-Navigation guard */}
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

      {/* Versionskonflikt-Dialog */}
      <VersionConflictDialog
        isOpen={conflictInfo !== null}
        entityLabel="Einstellungen"
        localVersion={localVersion}
        serverVersion={conflictInfo?.latestVersion ?? settingsVersion}
        changedAreas={changedAreas}
        onClose={() => setConflictInfo(null)}
        onAcceptServer={handleAcceptServer}
        onForceSave={conflictInfo?.latestVersion != null ? handleForceSave : undefined}
        isForcing={isForcingSave}
      />

      {/* Tab-switch guard */}
      <ConfirmDialog
        isOpen={pendingTab !== null}
        title="Ungespeicherte Änderungen"
        message="Es gibt ungespeicherte Änderungen. Beim Wechsel gehen diese verloren. Trotzdem wechseln?"
        confirmLabel="Wechseln"
        cancelLabel="Bleiben"
        variant="warning"
        onConfirm={() => {
          if (pendingTab) {
            setActiveTab(pendingTab);
            setIsDirty(false);
            if (settings) setLocalSettings(settings);
          }
          setPendingTab(null);
        }}
        onCancel={() => setPendingTab(null)}
      />
    </Layout>
  );
}
