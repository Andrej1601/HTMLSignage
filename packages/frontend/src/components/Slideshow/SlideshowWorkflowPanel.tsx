import { useState } from 'react';
import { ChevronDown, Clock3, FileClock, History, Layers, RotateCcw, Rocket, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { SectionCard } from '@/components/SectionCard';
import { StatusBadge } from '@/components/StatusBadge';
import type { Device } from '@/types/device.types';
import type { Event } from '@/types/settings.types';
import type { Schedule } from '@/types/schedule.types';
import type { SlideshowWorkflowEntry } from '@/services/api';

interface SlideshowWorkflowPanelProps {
  targetLabel: string;
  targetType: 'global' | 'device';
  liveUpdatedAt: string | null;
  liveSettingsVersion: number | null;
  draft: SlideshowWorkflowEntry | null;
  history: SlideshowWorkflowEntry[];
  activeEvent: Event | null;
  schedule: Schedule | null | undefined;
  selectedDevice: Device | null;
  disabled?: boolean;
  isWorking?: boolean;
  onDiscardDraft: () => void;
  onLoadHistoryEntry: (entry: SlideshowWorkflowEntry) => void;
  onRollbackEntry: (entry: SlideshowWorkflowEntry) => void;
  onDeleteHistoryEntry: (entry: SlideshowWorkflowEntry) => void;
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Noch nicht veröffentlicht';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unbekannt';
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getHistoryLabel(entry: SlideshowWorkflowEntry): string {
  return entry.action === 'slideshow.rollback' ? 'Rollback' : 'Veröffentlicht';
}

export function SlideshowWorkflowPanel({
  targetLabel,
  targetType,
  liveUpdatedAt,
  liveSettingsVersion,
  draft,
  history,
  activeEvent,
  schedule,
  selectedDevice,
  disabled = false,
  isWorking = false,
  onDiscardDraft,
  onLoadHistoryEntry,
  onRollbackEntry,
  onDeleteHistoryEntry,
}: SlideshowWorkflowPanelProps) {
  const deviceMode = selectedDevice?.mode ?? null;
  const [detailOpen, setDetailOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const visibleHistory = showAllHistory ? history : history.slice(0, 2);

  return (
    <SectionCard
      title="Workflow & Live-Stand"
      icon={Layers}
    >
      {/* Compact summary bar */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          label={`Live: ${targetType === 'global' ? 'Global' : targetLabel}`}
          tone={targetType === 'global' ? 'success' : (deviceMode === 'override' ? 'info' : 'warning')}
          showDot={false}
        />
        <StatusBadge
          label={draft ? 'Entwurf vorhanden' : 'Kein Entwurf'}
          tone={draft ? 'warning' : 'neutral'}
          showDot={false}
        />
        <StatusBadge
          label={activeEvent ? `Event: ${activeEvent.name}` : (schedule?.autoPlay ? 'Auto-Play' : 'Manuell')}
          tone={activeEvent ? 'info' : (schedule?.autoPlay ? 'success' : 'neutral')}
          showDot={false}
        />
        {draft && (
          <Button variant="ghost" size="sm" icon={Undo2} onClick={onDiscardDraft} disabled={disabled}>
            Entwurf verwerfen
          </Button>
        )}
      </div>

      {/* Toggle for detail view */}
      <button
        type="button"
        onClick={() => setDetailOpen((prev) => !prev)}
        className="mt-3 flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-sm font-semibold text-spa-text-secondary transition-colors hover:text-spa-text-primary"
      >
        <span>Details anzeigen</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${detailOpen ? 'rotate-180' : ''}`} />
      </button>

      {detailOpen && (
        <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-spa-bg-secondary bg-spa-bg-primary/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-spa-text-secondary">Live</p>
            <div className="mt-2 space-y-1 text-sm text-spa-text-secondary">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                <span>{formatTimestamp(liveUpdatedAt)}</span>
              </div>
              {typeof liveSettingsVersion === 'number' && (
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  <span>Version {liveSettingsVersion}</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-spa-bg-secondary bg-spa-bg-primary/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-spa-text-secondary">Entwurf</p>
            <div className="mt-2 space-y-1 text-sm text-spa-text-secondary">
              <div className="flex items-center gap-2">
                <FileClock className="h-4 w-4" />
                <span>{draft ? formatTimestamp(draft.timestamp) : 'Nichts gespeichert'}</span>
              </div>
              {draft?.user && <p>Von {draft.user.username}</p>}
            </div>
          </div>

          <div className="rounded-xl border border-spa-bg-secondary bg-spa-bg-primary/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-spa-text-secondary">Kontext</p>
            <div className="mt-2 space-y-1 text-sm text-spa-text-secondary">
              <p>{activeEvent ? `Event: ${activeEvent.name}` : 'Kein Event aktiv'}</p>
              <p>{schedule?.autoPlay ? 'Auto-Play aktiv' : 'Manuell gesteuert'}</p>
              {selectedDevice && (
                <p>{selectedDevice.name}: {selectedDevice.mode === 'override' ? 'Override' : 'Auto'}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History — show 2 by default */}
      <div className="mt-4 rounded-xl border border-spa-bg-secondary bg-spa-bg-primary/20">
        <div className="flex items-center gap-2 border-b border-spa-bg-secondary px-4 py-3">
          <History className="h-4 w-4 text-spa-text-secondary" />
          <h4 className="text-sm font-semibold text-spa-text-primary">Verlauf</h4>
          <span className="text-xs text-spa-text-secondary">({history.length})</span>
        </div>
        {history.length === 0 ? (
          <div className="px-4 py-4 text-sm text-spa-text-secondary">
            Noch keine Veröffentlichungen vorhanden.
          </div>
        ) : (
          <>
            <div className="divide-y divide-spa-bg-secondary">
              {visibleHistory.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-3 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={getHistoryLabel(entry)}
                        tone={entry.action === 'slideshow.rollback' ? 'warning' : 'success'}
                        showDot={false}
                      />
                      {entry.metadata.settingsVersion !== null && (
                        <StatusBadge label={`v${entry.metadata.settingsVersion}`} tone="neutral" showDot={false} />
                      )}
                      <span className="text-xs text-spa-text-secondary">{formatTimestamp(entry.timestamp)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => onLoadHistoryEntry(entry)} disabled={disabled}>
                      Laden
                    </Button>
                    <Button variant="secondary" size="sm" icon={Rocket} onClick={() => onRollbackEntry(entry)} disabled={disabled} loading={isWorking} loadingText="...">
                      Rollback
                    </Button>
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onDeleteHistoryEntry(entry)} disabled={disabled}>
                      Löschen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {history.length > 2 && !showAllHistory && (
              <button
                type="button"
                onClick={() => setShowAllHistory(true)}
                className="w-full border-t border-spa-bg-secondary px-4 py-2.5 text-xs font-medium text-spa-primary hover:bg-spa-bg-primary transition-colors"
              >
                Alle {history.length} Einträge anzeigen
              </button>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}
