import { useState, useRef, useEffect } from 'react';
import { Copy, ChevronDown, CalendarClock, Radio } from 'lucide-react';
import clsx from 'clsx';
import {
  PRESET_LABELS,
  WEEKDAY_PRESETS,
  SPECIAL_PRESETS,
  type PresetKey,
} from '@/types/schedule.types';
import type { UseScheduleEditorReturn } from '@/hooks/useScheduleEditor';

// Short labels for chip display
const PRESET_SHORT: Record<PresetKey, string> = {
  Mon: 'Mo', Tue: 'Di', Wed: 'Mi', Thu: 'Do', Fri: 'Fr', Sat: 'Sa', Sun: 'So',
  Opt: 'Opt', Evt1: 'Evt1', Evt2: 'Evt2',
};

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
  const copyMenuRef = useRef<HTMLDivElement>(null);

  // Close copy menu on outside click
  useEffect(() => {
    if (!showCopyMenu) return;
    function handleClick(e: MouseEvent) {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node)) {
        setShowCopyMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showCopyMenu]);

  const allPresets: PresetKey[] = [...WEEKDAY_PRESETS, ...SPECIAL_PRESETS];

  return (
    <div className="flex flex-col gap-2">
      {/* Editing ≠ Live notice */}
      {editor.editingPreset !== editor.livePreset && (
        <div className="flex items-center gap-2 rounded-lg border border-spa-secondary/25 bg-spa-secondary/8 px-3 py-2 text-xs text-spa-text-secondary">
          <Radio className="h-3.5 w-3.5 text-spa-secondary shrink-0" />
          Du bearbeitest <span className="font-semibold">{PRESET_LABELS[editor.editingPreset]}</span>
          &nbsp;— live läuft weiterhin <span className="font-semibold">{PRESET_LABELS[editor.livePreset]}</span>.
        </div>
      )}

      {/* Event-Plan Banner */}
      {editor.localSchedule?.autoPlay && editor.activeEvent && (
        <div className="flex items-center gap-2 rounded-lg border border-spa-accent/30 bg-spa-accent/10 px-3 py-2 text-xs text-spa-text-primary">
          <CalendarClock className="h-3.5 w-3.5 text-spa-accent shrink-0" />
          <span>
            <span className="font-semibold">Event aktiv: {editor.activeEvent.name}</span>
            &nbsp;— spielt {PRESET_LABELS[editor.livePreset]} ({editor.livePreset}).
          </span>
        </div>
      )}

      {/* Chip row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Weekday chips */}
        <div className="flex gap-1 flex-wrap">
          {WEEKDAY_PRESETS.map((preset) => (
            <PresetChip
              key={preset}
              preset={preset}
              editingPreset={editor.editingPreset}
              livePreset={editor.livePreset}
              variant="weekday"
              onPresetChange={editor.handlePresetChange}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-spa-bg-secondary mx-1" />

        {/* Special chips */}
        <div className="flex gap-1 flex-wrap">
          {SPECIAL_PRESETS.map((preset) => (
            <PresetChip
              key={preset}
              preset={preset}
              editingPreset={editor.editingPreset}
              livePreset={editor.livePreset}
              activeEventPreset={editor.activeEventPreset}
              variant="special"
              onPresetChange={editor.handlePresetChange}
            />
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* "Auswahl live schalten" */}
        {!editor.localSchedule?.autoPlay && editor.editingPreset !== editor.livePreset && (
          <button
            onClick={editor.handleSetLivePreset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-spa-secondary/40 bg-spa-secondary/10 px-3 py-1.5 text-xs font-medium text-spa-secondary-dark hover:bg-spa-secondary/20 transition-colors"
          >
            <Radio className="h-3.5 w-3.5" />
            Live schalten
          </button>
        )}

        {/* Copy menu */}
        <div className="relative" ref={copyMenuRef}>
          <button
            onClick={() => setShowCopyMenu((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-spa-bg-secondary bg-white px-3 py-1.5 text-xs font-medium text-spa-text-secondary hover:border-spa-primary/30 hover:text-spa-text-primary transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
            Kopieren
            <ChevronDown className={clsx('h-3.5 w-3.5 transition-transform', showCopyMenu && 'rotate-180')} />
          </button>

          {showCopyMenu && (
            <div className="absolute right-0 top-full z-30 mt-1.5 min-w-[180px] rounded-xl border border-spa-bg-secondary bg-white shadow-lg">
              <div className="p-1.5">
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-spa-text-secondary/60">
                  Wochentage
                </div>
                {WEEKDAY_PRESETS.map((preset) => (
                  <CopyMenuItem
                    key={preset}
                    preset={preset}
                    editingPreset={editor.editingPreset}
                    allPresets={allPresets}
                    onCopyFrom={(p) => { editor.handleCopyFrom(p); setShowCopyMenu(false); }}
                  />
                ))}
                <div className="my-1 border-t border-spa-bg-secondary" />
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-spa-text-secondary/60">
                  Spezial
                </div>
                {SPECIAL_PRESETS.map((preset) => (
                  <CopyMenuItem
                    key={preset}
                    preset={preset}
                    editingPreset={editor.editingPreset}
                    allPresets={allPresets}
                    onCopyFrom={(p) => { editor.handleCopyFrom(p); setShowCopyMenu(false); }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface PresetChipProps {
  preset: PresetKey;
  editingPreset: PresetKey;
  livePreset: PresetKey;
  activeEventPreset?: PresetKey;
  variant: 'weekday' | 'special';
  onPresetChange: (preset: PresetKey) => void;
}

function PresetChip({ preset, editingPreset, livePreset, activeEventPreset, variant, onPresetChange }: PresetChipProps) {
  const isActive = editingPreset === preset;
  const isLive = livePreset === preset;
  const isEventActive = activeEventPreset === preset;

  return (
    <button
      onClick={() => onPresetChange(preset)}
      title={PRESET_LABELS[preset]}
      className={clsx(
        'relative inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
        isActive && variant === 'weekday' && 'bg-spa-primary text-white shadow-sm',
        isActive && variant === 'special' && 'bg-spa-accent text-spa-text-primary shadow-sm',
        !isActive && 'bg-spa-bg-primary text-spa-text-secondary hover:bg-spa-bg-secondary hover:text-spa-text-primary',
      )}
    >
      {PRESET_SHORT[preset]}
      {/* Live dot */}
      {isLive && (
        <span className={clsx(
          'ml-0.5 h-1.5 w-1.5 rounded-full shrink-0',
          isActive ? 'bg-white/80' : 'bg-spa-primary'
        )} />
      )}
      {/* Event dot */}
      {isEventActive && !isLive && (
        <span className={clsx(
          'ml-0.5 h-1.5 w-1.5 rounded-full shrink-0',
          isActive ? 'bg-white/80' : 'bg-spa-accent'
        )} />
      )}
    </button>
  );
}

interface CopyMenuItemProps {
  preset: PresetKey;
  editingPreset: PresetKey;
  allPresets: PresetKey[];
  onCopyFrom: (preset: PresetKey) => void;
}

function CopyMenuItem({ preset, editingPreset, onCopyFrom }: CopyMenuItemProps) {
  const isSelf = preset === editingPreset;
  return (
    <button
      onClick={() => !isSelf && onCopyFrom(preset)}
      disabled={isSelf}
      className={clsx(
        'w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
        isSelf
          ? 'cursor-not-allowed text-spa-text-secondary/40'
          : 'text-spa-text-primary hover:bg-spa-bg-primary'
      )}
    >
      {PRESET_LABELS[preset]}
    </button>
  );
}
