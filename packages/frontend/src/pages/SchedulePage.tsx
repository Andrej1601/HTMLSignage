import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { ScheduleGrid } from '@/components/Schedule/ScheduleGrid';
import { CellEditor } from '@/components/Schedule/CellEditor';
import { TimeEditor } from '@/components/Schedule/TimeEditor';
import { useSchedule } from '@/hooks/useSchedule';
import { useSettings } from '@/hooks/useSettings';
import type { Schedule, PresetKey, Entry } from '@/types/schedule.types';
import type { Sauna } from '@/types/sauna.types';
import { SAUNA_STATUS_LABELS, SAUNA_STATUS_COLORS } from '@/types/sauna.types';
import {
  PRESET_LABELS,
  WEEKDAY_PRESETS,
  SPECIAL_PRESETS,
  getTodayPresetKey,
  sortTimeRows,
  copyDaySchedule,
  syncScheduleWithSaunas,
} from '@/types/schedule.types';
import { Save, RefreshCw, AlertCircle, Copy, Play } from 'lucide-react';
import clsx from 'clsx';

export function SchedulePage() {
  const { schedule, isLoading, error, save, isSaving, refetch } = useSchedule();
  const { settings } = useSettings();

  // Local state
  const [localSchedule, setLocalSchedule] = useState<Schedule | null>(null);
  const [activePreset, setActivePreset] = useState<PresetKey>('Mon');
  const [isDirty, setIsDirty] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);

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

  // Initialize local schedule from server data
  useEffect(() => {
    if (schedule && !localSchedule) {
      setLocalSchedule(schedule);
      // Set active preset based on autoPlay
      if (schedule.autoPlay) {
        setActivePreset(getTodayPresetKey());
      } else if (schedule.activePreset) {
        setActivePreset(schedule.activePreset);
      }
    }
  }, [schedule, localSchedule]);

  // Sync schedule with settings saunas
  useEffect(() => {
    if (localSchedule && settings?.saunas) {
      const saunaNames = settings.saunas
        .sort((a: Sauna, b: Sauna) => a.order - b.order)
        .map((s: Sauna) => s.name);

      // Check if saunas have changed
      const currentSaunas = localSchedule.presets[activePreset]?.saunas || [];
      const saunasChanged =
        currentSaunas.length !== saunaNames.length ||
        currentSaunas.some((name, i) => name !== saunaNames[i]);

      if (saunasChanged) {
        const syncedSchedule = syncScheduleWithSaunas(localSchedule, saunaNames);
        setLocalSchedule(syncedSchedule);
        setIsDirty(true);
      }
    }
  }, [settings?.saunas, localSchedule, activePreset]);

  // Get current day schedule
  const currentDaySchedule = localSchedule?.presets?.[activePreset];

  // Handle preset tab change
  const handlePresetChange = (preset: PresetKey) => {
    setActivePreset(preset);
    if (localSchedule && !localSchedule.autoPlay) {
      // Update activePreset in manual mode
      setLocalSchedule({
        ...localSchedule,
        activePreset: preset,
      });
      setIsDirty(true);
    }
  };

  // Handle auto-play toggle
  const handleAutoPlayToggle = () => {
    if (!localSchedule) return;

    const newAutoPlay = !localSchedule.autoPlay;
    setLocalSchedule({
      ...localSchedule,
      autoPlay: newAutoPlay,
      activePreset: newAutoPlay ? undefined : activePreset,
    });
    setIsDirty(true);

    if (newAutoPlay) {
      setActivePreset(getTodayPresetKey());
    }
  };

  // Handle copy from another day
  const handleCopyFrom = (sourcePreset: PresetKey) => {
    if (!localSchedule) return;

    const sourceDaySchedule = localSchedule.presets[sourcePreset];
    const copiedSchedule = copyDaySchedule(sourceDaySchedule);

    setLocalSchedule({
      ...localSchedule,
      presets: {
        ...localSchedule.presets,
        [activePreset]: copiedSchedule,
      },
    });
    setIsDirty(true);
    setShowCopyMenu(false);
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
      // Adding new time row
      const newRow = {
        time: newTime,
        entries: currentDaySchedule.saunas.map(() => null),
      };
      const updatedRows = sortTimeRows([...currentDaySchedule.rows, newRow]);

      setLocalSchedule({
        ...localSchedule,
        presets: {
          ...localSchedule.presets,
          [activePreset]: {
            ...currentDaySchedule,
            rows: updatedRows,
          },
        },
      });
    } else {
      // Editing existing time
      const updatedRows = [...currentDaySchedule.rows];
      updatedRows[editingTime.timeRowIndex].time = newTime;
      const sortedRows = sortTimeRows(updatedRows);

      setLocalSchedule({
        ...localSchedule,
        presets: {
          ...localSchedule.presets,
          [activePreset]: {
            ...currentDaySchedule,
            rows: sortedRows,
          },
        },
      });
    }

    setIsDirty(true);
    setEditingTime(null);
  };

  // Handle delete time row
  const handleDeleteTimeRow = (timeRowIndex: number) => {
    if (!localSchedule || !currentDaySchedule) return;

    const updatedRows = currentDaySchedule.rows.filter((_, i) => i !== timeRowIndex);

    setLocalSchedule({
      ...localSchedule,
      presets: {
        ...localSchedule.presets,
        [activePreset]: {
          ...currentDaySchedule,
          rows: updatedRows,
        },
      },
    });
    setIsDirty(true);
  };

  // Handle save cell
  const handleSaveCell = (entry: Entry | null) => {
    if (!localSchedule || !currentDaySchedule || !editingCell) return;

    const updatedRows = [...currentDaySchedule.rows];
    updatedRows[editingCell.timeRowIndex].entries[editingCell.saunaIndex] = entry;

    setLocalSchedule({
      ...localSchedule,
      presets: {
        ...localSchedule.presets,
        [activePreset]: {
          ...currentDaySchedule,
          rows: updatedRows,
        },
      },
    });
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

    const scheduleToSave = {
      ...localSchedule,
      version: (localSchedule.version || 1) + 1,
    };

    save(scheduleToSave, {
      onSuccess: () => {
        setIsDirty(false);
        refetch();
      },
    });
  };

  if (isLoading || !localSchedule) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-spa-text-secondary">Lädt Aufgussplan...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Fehler beim Laden</h3>
            <p className="text-red-700 text-sm mt-1">
              {error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-spa-text-primary">Aufgussplan</h2>
            <p className="text-spa-text-secondary mt-1">
              Version {localSchedule?.version || 1}
              {isDirty && (
                <span className="ml-2 text-orange-600 font-medium">• Ungespeicherte Änderungen</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {/* Auto-Play Toggle */}
            <button
              onClick={handleAutoPlayToggle}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-md transition-colors',
                localSchedule?.autoPlay
                  ? 'bg-spa-secondary text-white'
                  : 'bg-spa-bg-secondary text-spa-text-secondary hover:bg-spa-bg-secondary'
              )}
            >
              <Play className="w-4 h-4" />
              Auto-Play
            </button>

            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-spa-text-secondary hover:bg-spa-bg-secondary rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Neu laden
            </button>

            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </div>

        {/* Preset Tabs */}
        <div className="mb-6">
          {/* Weekday Tabs */}
          <div className="flex gap-2 mb-2">
            {WEEKDAY_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetChange(preset)}
                className={clsx(
                  'px-4 py-2 rounded-t-lg font-medium transition-colors',
                  activePreset === preset
                    ? 'bg-spa-primary text-white'
                    : 'bg-spa-bg-secondary text-spa-text-secondary hover:bg-spa-bg-secondary/70'
                )}
              >
                {PRESET_LABELS[preset]}
              </button>
            ))}
          </div>

          {/* Special Presets */}
          <div className="flex gap-2">
            {SPECIAL_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetChange(preset)}
                className={clsx(
                  'px-4 py-2 rounded-t-lg font-medium transition-colors border-2',
                  activePreset === preset
                    ? 'bg-spa-accent text-spa-text-primary border-spa-accent'
                    : 'bg-white text-spa-text-secondary border-spa-bg-secondary hover:border-spa-accent/50'
                )}
              >
                {PRESET_LABELS[preset]}
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
                        disabled={preset === activePreset}
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
                        disabled={preset === activePreset}
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
        </div>

        {/* Sauna Status Info */}
        {settings?.saunas && settings.saunas.length > 0 && (
          <div className="mb-6 bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-spa-text-primary mb-3">Sauna Status</h3>
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
          </div>
        )}

        {/* Grid */}
        {currentDaySchedule && (
          <ScheduleGrid
            daySchedule={currentDaySchedule}
            onEditCell={handleEditCell}
            onEditTime={handleEditTime}
            onAddTimeRow={handleAddTimeRow}
            onDeleteTimeRow={handleDeleteTimeRow}
          />
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
      </div>
    </Layout>
  );
}
