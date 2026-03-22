import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Skeleton } from '@/components/Skeleton';
import { ScheduleGrid } from '@/components/Schedule/ScheduleGrid';
import { CellEditor } from '@/components/Schedule/CellEditor';
import { TimeEditor } from '@/components/Schedule/TimeEditor';
import { useSchedule } from '@/hooks/useSchedule';
import { useSettings } from '@/hooks/useSettings';
import { useDevices } from '@/hooks/useDevices';
import { usePersistentEditorDraft } from '@/hooks/usePersistentEditorDraft';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useAuth } from '@/contexts/AuthContext';
import { getActiveEvent } from '@/types/settings.types';
import type { Schedule, PresetKey, Entry } from '@/types/schedule.types';
import type { Sauna } from '@/types/sauna.types';
import { SAUNA_STATUS_LABELS, SAUNA_STATUS_COLORS } from '@/types/sauna.types';
import {
  PRESET_LABELS,
  WEEKDAY_PRESETS,
  SPECIAL_PRESETS,
  getTodayPresetKey,
  resolveLivePresetKey,
  syncScheduleWithSaunas,
} from '@/types/schedule.types';
import { ErrorAlert } from '@/components/ErrorAlert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';
import { EditorQualityAssistant } from '@/components/EditorQualityAssistant';
import { DraftRecoveryBanner } from '@/components/DraftRecoveryBanner';
import { Save, RefreshCw, Copy, Play, CalendarClock, Calendar, MonitorSmartphone } from 'lucide-react';
import { Button } from '@/components/Button';
import clsx from 'clsx';
import { getModeLabel } from '@/types/device.types';
import { hasDeviceOverrides } from '@/utils/deviceUtils';
import { getScheduleQualityIssues } from '@/utils/editorQuality';
import {
  formatDateTimeLocalInput,
  resolveInitialEditingPreset,
  withAddedTimeRow,
  withAutoPlayToggled,
  withCellEntry,
  withCopiedPreset,
  withDeletedTimeRow,
  withIncrementedScheduleVersion,
  withManualActivePreset,
  withUpdatedTimeRow,
} from './schedulePage.utils';

export function SchedulePage() {
  const { user } = useAuth();
  const { schedule, isLoading, error, save, isSaving, refetch } = useSchedule();
  const { settings } = useSettings();
  const { data: devices } = useDevices();

  // Local state
  const [localSchedule, setLocalSchedule] = useState<Schedule | null>(null);
  const [editingPreset, setEditingPreset] = useState<PresetKey>('Mon');
  const [isDirty, setIsDirty] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [pendingCopySource, setPendingCopySource] = useState<PresetKey | null>(null);
  const [eventClock, setEventClock] = useState(() => Date.now());
  const [simulationDateTime, setSimulationDateTime] = useState(() => formatDateTimeLocalInput(new Date()));
  const [simulationDeviceId, setSimulationDeviceId] = useState<string>('');

  // Cell editor state
  const [editingCell, setEditingCell] = useState<{
    timeRowIndex: number;
    saunaIndex: number;
    entry: Entry | null;
  } | null>(null);

  // Time editor state
  const [editingTime, setEditingTime] = useState<{
    timeRowIndex: number;
    currentTime: string;
  } | null>(null);

  const draftStorageKey = `htmlsignage_editor_draft_schedule_${user?.id || 'anonymous'}`;

  const draftState = usePersistentEditorDraft<Schedule, { editingPreset: PresetKey }>({
    storageKey: draftStorageKey,
    value: localSchedule,
    meta: { editingPreset },
    isDirty,
    enabled: Boolean(localSchedule),
  });

  const unsavedGuard = useUnsavedChangesGuard({
    when: isDirty,
  });

  // Initialize local schedule from server data
  useEffect(() => {
    if (schedule && !localSchedule && !draftState.hasStoredDraft) {
      setLocalSchedule(schedule);
      setEditingPreset(resolveInitialEditingPreset(schedule, settings));
    }
  }, [draftState.hasStoredDraft, schedule, localSchedule, settings]);

  useEffect(() => {
    const interval = setInterval(() => setEventClock(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Sync schedule with settings saunas
  useEffect(() => {
    if (localSchedule && settings?.saunas) {
      const saunaNames = settings.saunas
        .sort((a: Sauna, b: Sauna) => a.order - b.order)
        .map((s: Sauna) => s.name);

      // Check if saunas have changed
      const currentSaunas = localSchedule.presets[editingPreset]?.saunas || [];
      const saunasChanged =
        currentSaunas.length !== saunaNames.length ||
        currentSaunas.some((name, i) => name !== saunaNames[i]);

      if (saunasChanged) {
        const syncedSchedule = syncScheduleWithSaunas(localSchedule, saunaNames);
        setLocalSchedule(syncedSchedule);
        setIsDirty(true);
      }
    }
  }, [settings?.saunas, localSchedule, editingPreset]);

  const saunaColors = useMemo(() => {
    const map: Record<string, string> = {};
    if (settings?.saunas) {
      for (const s of settings.saunas) {
        if (s.color) map[s.name] = s.color;
      }
    }
    return map;
  }, [settings?.saunas]);

  const now = new Date(eventClock);
  const pairedDevices = useMemo(
    () => (devices || []).filter((device) => Boolean(device.pairedAt)),
    [devices],
  );
  const simulationNow = useMemo(() => {
    const parsed = simulationDateTime ? new Date(simulationDateTime) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [simulationDateTime]);
  const selectedSimulationDevice = useMemo(
    () => pairedDevices.find((device) => device.id === simulationDeviceId) || null,
    [pairedDevices, simulationDeviceId],
  );
  const livePreset: PresetKey = localSchedule
    ? resolveLivePresetKey(localSchedule, settings, now)
    : getTodayPresetKey(now);

  // Get current day schedule
  const currentDaySchedule = localSchedule?.presets?.[editingPreset];
  const activeEvent = settings ? getActiveEvent(settings, now) : null;
  const activeEventPreset = activeEvent?.assignedPreset;
  const scheduleQualityIssues = useMemo(() => getScheduleQualityIssues({
    schedule: localSchedule,
    presetKey: editingPreset,
    settings,
  }), [editingPreset, localSchedule, settings]);
  const simulatedEvent = settings
    ? getActiveEvent(settings, simulationNow, simulationDeviceId || undefined)
    : null;
  const simulatedPreset: PresetKey = localSchedule
    ? resolveLivePresetKey(localSchedule, settings, simulationNow, simulationDeviceId || undefined)
    : getTodayPresetKey(simulationNow);

  // Handle preset tab change
  const handlePresetChange = (preset: PresetKey) => {
    setEditingPreset(preset);
  };

  const handleSetLivePreset = () => {
    if (!localSchedule || localSchedule.autoPlay) return;
    if (localSchedule.activePreset === editingPreset) return;

    setLocalSchedule(withManualActivePreset(localSchedule, editingPreset));
    setIsDirty(true);
  };

  // Handle auto-play toggle
  const handleAutoPlayToggle = () => {
    if (!localSchedule) return;

    setLocalSchedule(withAutoPlayToggled(localSchedule, settings, now));
    setIsDirty(true);
  };

  // Handle copy from another day
  const handleCopyFrom = (sourcePreset: PresetKey) => {
    if (!localSchedule) return;
    setPendingCopySource(sourcePreset);
    setShowCopyMenu(false);
  };

  const confirmCopyFrom = () => {
    if (!localSchedule || !pendingCopySource) return;
    setLocalSchedule(withCopiedPreset(localSchedule, pendingCopySource, editingPreset));
    setIsDirty(true);
    setPendingCopySource(null);
  };

  // Handle edit cell
  const handleEditCell = (timeRowIndex: number, saunaIndex: number) => {
    if (!currentDaySchedule) return;

    const entry = currentDaySchedule.rows[timeRowIndex].entries[saunaIndex];
    setEditingCell({ timeRowIndex, saunaIndex, entry });
  };

  // Handle add time row
  const handleAddTimeRow = () => {
    if (!localSchedule || !currentDaySchedule) return;
    // Open time editor for new row
    setEditingTime({ timeRowIndex: -1, currentTime: '12:00' });
  };

  // Handle edit time
  const handleEditTime = (timeRowIndex: number) => {
    if (!currentDaySchedule) return;
    const currentTime = currentDaySchedule.rows[timeRowIndex].time;
    setEditingTime({ timeRowIndex, currentTime });
  };

  // Handle save time
  const handleSaveTime = (newTime: string) => {
    if (!localSchedule || !currentDaySchedule || !editingTime) return;

    if (editingTime.timeRowIndex === -1) {
      setLocalSchedule(withAddedTimeRow(localSchedule, editingPreset, newTime));
    } else {
      setLocalSchedule(withUpdatedTimeRow(localSchedule, editingPreset, editingTime.timeRowIndex, newTime));
    }

    setIsDirty(true);
    setEditingTime(null);
  };

  // Handle delete time row
  const handleDeleteTimeRow = (timeRowIndex: number) => {
    if (!localSchedule || !currentDaySchedule) return;

    setLocalSchedule(withDeletedTimeRow(localSchedule, editingPreset, timeRowIndex));
    setIsDirty(true);
  };

  // Handle save cell
  const handleSaveCell = (entry: Entry | null) => {
    if (!localSchedule || !currentDaySchedule || !editingCell) return;

    setLocalSchedule(
      withCellEntry(
        localSchedule,
        editingPreset,
        editingCell.timeRowIndex,
        editingCell.saunaIndex,
        entry,
      ),
    );
    setIsDirty(true);
    setEditingCell(null);
  };

  // Handle delete cell
  const handleDeleteCell = () => {
    if (!editingCell) return;
    handleSaveCell(null); // Set to null to clear
  };

  // Save to server
  const handleSave = () => {
    if (!localSchedule) return;

    const scheduleToSave = withIncrementedScheduleVersion(localSchedule);

    save(scheduleToSave, {
      onSuccess: () => {
        draftState.clearDraft();
        setIsDirty(false);
        refetch();
      },
    });
  };

  const resetToLiveSchedule = () => {
    if (!schedule) return;
    setLocalSchedule(schedule);
    setEditingPreset(resolveInitialEditingPreset(schedule, settings));
    setIsDirty(false);
  };

  const handleRestoreDraft = () => {
    const restored = draftState.restoreDraft();
    if (!restored) return;

    setLocalSchedule(restored.value);
    setEditingPreset(restored.meta?.editingPreset || getTodayPresetKey());
    setIsDirty(true);
  };

  const handleDiscardDraft = () => {
    draftState.clearDraft();
    resetToLiveSchedule();
  };

  if (isLoading || !localSchedule) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="h-20 animate-pulse rounded-2xl bg-spa-bg-secondary" />
          <div className="rounded-xl border border-spa-bg-secondary bg-white p-6 space-y-4">
            <div className="flex gap-2">
              {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} variant="rect" className="h-10 w-16 rounded-lg" />)}
            </div>
            <Skeleton variant="rect" className="h-64 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <ErrorAlert error={error} onRetry={() => refetch()} />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Aufgussplan"
          description={`Version ${localSchedule?.version || 1} · Live: ${PRESET_LABELS[livePreset]} · Bearbeitung: ${PRESET_LABELS[editingPreset]}`}
          icon={Calendar}
          actions={(
            <div className="flex flex-wrap gap-2">
              <Button
                variant={localSchedule?.autoPlay ? 'secondary' : 'ghost'}
                icon={Play}
                onClick={handleAutoPlayToggle}
                className={localSchedule?.autoPlay ? '!bg-spa-secondary !text-white !hover:bg-spa-secondary-dark' : ''}
              >
                Auto-Play
              </Button>

              {!localSchedule.autoPlay && (
                <Button
                  variant="ghost"
                  onClick={handleSetLivePreset}
                  disabled={editingPreset === livePreset}
                  className="border border-spa-secondary text-spa-secondary hover:bg-spa-secondary/10"
                >
                  Auswahl live schalten
                </Button>
              )}

              <Button variant="ghost" icon={RefreshCw} onClick={() => { draftState.clearDraft(); setLocalSchedule(null); setIsDirty(false); refetch(); }} disabled={isLoading}>
                Neu laden
              </Button>

              <Button icon={Save} onClick={handleSave} disabled={!isDirty} loading={isSaving} loadingText="Speichert...">
                Speichern
              </Button>
            </div>
          )}
          badges={[
            { label: `Live v${schedule?.version || localSchedule.version}`, tone: 'info' },
            draftState.hasStoredDraft && !isDirty
              ? { label: 'Lokaler Entwurf vorhanden', tone: 'warning' as const }
              : { label: 'Live-Stand', tone: 'neutral' as const },
            { label: localSchedule.autoPlay ? 'Auto-Play' : 'Manuell', tone: localSchedule.autoPlay ? 'success' as const : 'warning' as const },
            { label: isDirty ? 'Ungespeicherte Änderungen' : 'Alles gespeichert', tone: isDirty ? 'warning' as const : 'success' as const },
          ]}
        />

        {draftState.hasStoredDraft && !isDirty && (
          <DraftRecoveryBanner
            entityLabel="Aufgussplan"
            updatedAt={draftState.draftUpdatedAt}
            onRestore={handleRestoreDraft}
            onDiscard={handleDiscardDraft}
          />
        )}

        {/* Unsaved changes banner */}
        {isDirty && (
          <div className="flex items-center gap-3 rounded-lg border-2 border-amber-400 bg-amber-50 px-5 py-3 shadow-sm">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
            </span>
            <span className="text-sm font-semibold text-amber-800">Ungespeicherte Änderungen — oben auf Speichern klicken, um zu sichern.</span>
          </div>
        )}

        <EditorQualityAssistant
          description={`Direkte Plausibilitätschecks für ${PRESET_LABELS[editingPreset]} und den aktuellen Redaktionsstand.`}
          issues={scheduleQualityIssues}
          okMessage={`Für ${PRESET_LABELS[editingPreset]} wurden aktuell keine strukturellen Planprobleme erkannt.`}
        />

        <SectionCard
          title="Simulation"
          description="Prüfen Sie vorab, welcher Plan für einen Zeitpunkt und optional für ein bestimmtes Gerät live wäre."
          icon={MonitorSmartphone}
        >
          <div className="grid gap-4 xl:grid-cols-[260px_260px_1fr]">
            <div>
              <label className="mb-2 block text-sm font-medium text-spa-text-primary">Zeitpunkt</label>
              <input
                type="datetime-local"
                value={simulationDateTime}
                onChange={(event) => setSimulationDateTime(event.target.value)}
                className="w-full rounded-lg border border-spa-bg-secondary px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-spa-primary"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-spa-text-primary">Gerätefilter</label>
              <select
                value={simulationDeviceId}
                onChange={(event) => setSimulationDeviceId(event.target.value)}
                className="w-full rounded-lg border border-spa-bg-secondary px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-spa-primary"
              >
                <option value="">Kein Gerät filtern</option>
                {pairedDevices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-spa-bg-primary px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">Live-Preset</div>
                <div className="mt-1 text-lg font-semibold text-spa-text-primary">
                  {PRESET_LABELS[simulatedPreset]}
                </div>
                <div className="mt-1 text-xs text-spa-text-secondary">{simulatedPreset}</div>
              </div>

              <div className="rounded-xl bg-spa-bg-primary px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">Aktives Event</div>
                <div className="mt-1 text-lg font-semibold text-spa-text-primary">
                  {simulatedEvent ? simulatedEvent.name : 'Keins'}
                </div>
                <div className="mt-1 text-xs text-spa-text-secondary">
                  {simulatedEvent ? `${PRESET_LABELS[simulatedEvent.assignedPreset]} · bis ${simulatedEvent.endTime || '23:59'}` : 'Auto-Play / manueller Tagesplan'}
                </div>
              </div>

              <div className="rounded-xl bg-spa-bg-primary px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">Gerätekontext</div>
                <div className="mt-1 text-lg font-semibold text-spa-text-primary">
                  {selectedSimulationDevice ? selectedSimulationDevice.name : 'Global'}
                </div>
                <div className="mt-1 text-xs text-spa-text-secondary">
                  {selectedSimulationDevice
                    ? `${getModeLabel(selectedSimulationDevice.mode)}${hasDeviceOverrides(selectedSimulationDevice) ? ' · Override hinterlegt' : ''}`
                    : 'ohne Gerätefilter'}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Preset Tabs */}
        <SectionCard title="Preset-Auswahl" icon={CalendarClock}>
          {localSchedule.autoPlay && activeEvent && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-spa-accent/30 bg-spa-accent/10 px-4 py-3">
              <CalendarClock className="mt-0.5 h-5 w-5 text-spa-accent" />
              <div>
                <p className="text-sm font-semibold text-spa-text-primary">
                  Event-Plan aktiv: {activeEvent.name}
                </p>
                <p className="text-xs text-spa-text-secondary">
                  Aktuell wird {PRESET_LABELS[livePreset]} ({livePreset}) abgespielt.
                </p>
              </div>
            </div>
          )}

          {editingPreset !== livePreset && (
            <div className="mb-4 rounded-lg border border-spa-secondary/30 bg-spa-secondary/10 px-4 py-3 text-xs text-spa-text-secondary">
              Du bearbeitest {PRESET_LABELS[editingPreset]} ({editingPreset}), live läuft weiterhin {PRESET_LABELS[livePreset]} ({livePreset}).
            </div>
          )}

          {/* Weekday Tabs */}
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1 -mx-1 px-1">
            {WEEKDAY_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetChange(preset)}
                className={clsx(
                  'px-4 py-2 rounded-t-lg font-medium transition-colors',
                  editingPreset === preset
                    ? 'bg-spa-primary text-white'
                    : 'bg-spa-bg-secondary text-spa-text-secondary hover:bg-spa-bg-secondary/70'
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <span>{PRESET_LABELS[preset]}</span>
                  {livePreset === preset && (
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        editingPreset === preset
                          ? 'bg-white/80 text-spa-primary'
                          : 'bg-spa-primary/15 text-spa-primary'
                      )}
                    >
                      Live
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* Special Presets */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {SPECIAL_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetChange(preset)}
                className={clsx(
                  'px-4 py-2 rounded-t-lg font-medium transition-colors border-2',
                  editingPreset === preset
                    ? 'bg-spa-accent text-spa-text-primary border-spa-accent'
                    : 'bg-white text-spa-text-secondary border-spa-bg-secondary hover:border-spa-accent/50'
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <span>{PRESET_LABELS[preset]}</span>
                  {livePreset === preset && (
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        editingPreset === preset
                          ? 'bg-white/80 text-spa-accent'
                          : 'bg-spa-accent/15 text-spa-accent'
                      )}
                    >
                      Live
                    </span>
                  )}
                  {localSchedule.autoPlay && activeEventPreset === preset && (
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        editingPreset === preset
                          ? 'bg-white/80 text-spa-accent'
                          : 'bg-spa-accent/15 text-spa-accent'
                      )}
                    >
                      Event aktiv
                    </span>
                  )}
                </span>
              </button>
            ))}

            {/* Copy From Button */}
            <div className="relative ml-auto">
              <button
                onClick={() => setShowCopyMenu(!showCopyMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-spa-bg-secondary rounded-t-lg text-spa-text-secondary hover:border-spa-secondary transition-colors"
              >
                <Copy className="w-4 h-4" />
                Aus Tag X laden
              </button>

              {/* Copy Menu */}
              {showCopyMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-spa-bg-secondary rounded-lg shadow-lg z-10 min-w-[200px]">
                  <div className="p-2">
                    <div className="text-xs font-semibold text-spa-text-secondary px-2 py-1">Wochentage</div>
                    {WEEKDAY_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => handleCopyFrom(preset)}
                        disabled={preset === editingPreset}
                        className="w-full text-left px-3 py-2 rounded text-sm hover:bg-spa-bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {PRESET_LABELS[preset]}
                      </button>
                    ))}

                    <div className="text-xs font-semibold text-spa-text-secondary px-2 py-1 mt-2">Spezial</div>
                    {SPECIAL_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => handleCopyFrom(preset)}
                        disabled={preset === editingPreset}
                        className="w-full text-left px-3 py-2 rounded text-sm hover:bg-spa-bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {PRESET_LABELS[preset]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Sauna Status Info */}
        {settings?.saunas && settings.saunas.length > 0 && (
          <SectionCard title="Sauna-Status">
            <div className="flex flex-wrap gap-3">
              {settings.saunas
                .sort((a: Sauna, b: Sauna) => a.order - b.order)
                .map((sauna: Sauna) => (
                  <div
                    key={sauna.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-md border"
                    style={{
                      borderColor: sauna.color || '#10b981',
                      backgroundColor: `${sauna.color || '#10b981'}10`,
                    }}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: SAUNA_STATUS_COLORS[sauna.status] }}
                    />
                    <span className="font-medium text-sm">{sauna.name}</span>
                    <span className="text-xs text-spa-text-secondary">
                      ({SAUNA_STATUS_LABELS[sauna.status]})
                    </span>
                    {sauna.info?.temperature && (
                      <span className="text-xs text-spa-text-secondary ml-2">
                        {sauna.info.temperature}°C
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </SectionCard>
        )}

        {/* Grid */}
        {currentDaySchedule && (
          <SectionCard title={`Tagesplan: ${PRESET_LABELS[editingPreset]}`} noPadding>
            <ScheduleGrid
              daySchedule={currentDaySchedule}
              aromas={settings?.aromas || []}
              saunaColors={saunaColors}
              onEditCell={handleEditCell}
              onEditTime={handleEditTime}
              onAddTimeRow={handleAddTimeRow}
              onDeleteTimeRow={handleDeleteTimeRow}
            />
          </SectionCard>
        )}

        {/* Cell Editor Dialog */}
        <CellEditor
          entry={editingCell?.entry || null}
          isOpen={editingCell !== null}
          onClose={() => setEditingCell(null)}
          onSave={handleSaveCell}
          onDelete={editingCell?.entry ? handleDeleteCell : undefined}
          aromas={settings?.aromas || []}
        />

        {/* Time Editor Dialog */}
        <TimeEditor
          time={editingTime?.currentTime || null}
          isOpen={editingTime !== null}
          onClose={() => setEditingTime(null)}
          onSave={handleSaveTime}
        />
        <ConfirmDialog
          isOpen={unsavedGuard.isBlocked}
          title="Ungespeicherte Änderungen"
          message="Es gibt ungespeicherte Änderungen im Aufgussplan. Wirklich verlassen?"
          confirmLabel="Verlassen"
          cancelLabel="Bleiben"
          variant="warning"
          onConfirm={unsavedGuard.proceed}
          onCancel={unsavedGuard.reset}
        />
        <ConfirmDialog
          isOpen={Boolean(pendingCopySource)}
          title="Tagesplan überschreiben?"
          message={(() => {
            if (!pendingCopySource || !localSchedule) return '';
            const source = localSchedule.presets[pendingCopySource];
            const target = currentDaySchedule;
            const sourceRows = source?.rows?.length || 0;
            const targetRows = target?.rows?.length || 0;
            return `${PRESET_LABELS[pendingCopySource]} (${sourceRows} Zeitslots) → ${PRESET_LABELS[editingPreset]} (${targetRows} Zeitslots)\n\nDer aktuelle Plan für ${PRESET_LABELS[editingPreset]} wird vollständig durch den Plan von ${PRESET_LABELS[pendingCopySource]} ersetzt.`;
          })()}
          confirmLabel="Überschreiben"
          variant="warning"
          onConfirm={confirmCopyFrom}
          onCancel={() => setPendingCopySource(null)}
        />
      </div>
    </Layout>
  );
}
