import { useState } from 'react';
import { Copy, CalendarClock } from 'lucide-react';
import clsx from 'clsx';
import { SectionCard } from '@/components/SectionCard';
import { Button } from '@/components/Button';
import {
  PRESET_LABELS,
  WEEKDAY_PRESETS,
  SPECIAL_PRESETS,
  type PresetKey,
} from '@/types/schedule.types';
import type { UseScheduleEditorReturn } from '@/hooks/useScheduleEditor';

interface PresetTabsProps {
  editor: Pick<
    UseScheduleEditorReturn,
    | 'editingPreset'
    | 'livePreset'
    | 'localSchedule'
    | 'activeEvent'
    | 'activeEventPreset'
    | 'handlePresetChange'
    | 'handleCopyFrom'
    | 'handleSetLivePreset'
    | 'pendingCopySource'
    | 'confirmCopyFrom'
    | 'setPendingCopySource'
  >;
}

export function PresetTabs({ editor }: PresetTabsProps) {
  const [showCopyMenu, setShowCopyMenu] = useState(false);

  return (
    <SectionCard title="Preset-Auswahl" icon={CalendarClock}>
      {editor.localSchedule?.autoPlay && editor.activeEvent && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-spa-accent/30 bg-spa-accent/10 px-4 py-3">
          <CalendarClock className="mt-0.5 h-5 w-5 text-spa-accent" />
          <div>
            <p className="text-sm font-semibold text-spa-text-primary">
              Event-Plan aktiv: {editor.activeEvent.name}
            </p>
            <p className="text-xs text-spa-text-secondary">
              Aktuell wird {PRESET_LABELS[editor.livePreset]} ({editor.livePreset}) abgespielt.
            </p>
          </div>
        </div>
      )}

      {editor.editingPreset !== editor.livePreset && (
        <div className="mb-4 rounded-lg border border-spa-secondary/30 bg-spa-secondary/10 px-4 py-3 text-xs text-spa-text-secondary">
          Du bearbeitest {PRESET_LABELS[editor.editingPreset]} ({editor.editingPreset}), live läuft weiterhin {PRESET_LABELS[editor.livePreset]} ({editor.livePreset}).
        </div>
      )}

      <WeekdayTabs
        editingPreset={editor.editingPreset}
        livePreset={editor.livePreset}
        onPresetChange={editor.handlePresetChange}
      />

      <SpecialTabs
        editingPreset={editor.editingPreset}
        livePreset={editor.livePreset}
        activeEventPreset={editor.activeEventPreset}
        autoPlay={editor.localSchedule?.autoPlay}
        onPresetChange={editor.handlePresetChange}
      />

      <CopyMenu
        showCopyMenu={showCopyMenu}
        setShowCopyMenu={setShowCopyMenu}
        editingPreset={editor.editingPreset}
        onCopyFrom={editor.handleCopyFrom}
      />

      {!editor.localSchedule?.autoPlay && (
        <Button
          variant="ghost"
          onClick={editor.handleSetLivePreset}
          disabled={editor.editingPreset === editor.livePreset}
          className="mt-2 border border-spa-secondary text-spa-secondary hover:bg-spa-secondary/10"
        >
          Auswahl live schalten
        </Button>
      )}
    </SectionCard>
  );
}

interface WeekdayTabsProps {
  editingPreset: PresetKey;
  livePreset: PresetKey;
  onPresetChange: (preset: PresetKey) => void;
}

function WeekdayTabs({ editingPreset, livePreset, onPresetChange }: WeekdayTabsProps) {
  return (
    <div className="flex gap-2 mb-2 overflow-x-auto pb-1 -mx-1 px-1">
      {WEEKDAY_PRESETS.map((preset) => (
        <button
          key={preset}
          onClick={() => onPresetChange(preset)}
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
  );
}

interface SpecialTabsProps {
  editingPreset: PresetKey;
  livePreset: PresetKey;
  activeEventPreset: PresetKey | undefined;
  autoPlay: boolean | undefined;
  onPresetChange: (preset: PresetKey) => void;
}

function SpecialTabs({ editingPreset, livePreset, activeEventPreset, autoPlay, onPresetChange }: SpecialTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {SPECIAL_PRESETS.map((preset) => (
        <button
          key={preset}
          onClick={() => onPresetChange(preset)}
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
            {autoPlay && activeEventPreset === preset && (
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
    </div>
  );
}

interface CopyMenuProps {
  showCopyMenu: boolean;
  setShowCopyMenu: (show: boolean) => void;
  editingPreset: PresetKey;
  onCopyFrom: (preset: PresetKey) => void;
}

function CopyMenu({ showCopyMenu, setShowCopyMenu, editingPreset, onCopyFrom }: CopyMenuProps) {
  return (
    <div className="relative ml-auto">
      <button
        onClick={() => setShowCopyMenu(!showCopyMenu)}
        className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-spa-bg-secondary rounded-t-lg text-spa-text-secondary hover:border-spa-secondary transition-colors"
      >
        <Copy className="w-4 h-4" />
        Aus Tag X laden
      </button>

      {showCopyMenu && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-spa-bg-secondary rounded-lg shadow-lg z-10 min-w-[200px]">
          <div className="p-2">
            <div className="text-xs font-semibold text-spa-text-secondary px-2 py-1">Wochentage</div>
            {WEEKDAY_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => onCopyFrom(preset)}
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
                onClick={() => onCopyFrom(preset)}
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
  );
}
