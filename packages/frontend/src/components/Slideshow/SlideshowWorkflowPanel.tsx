import { Clock3, FileClock, History, Layers, RotateCcw, Rocket, Trash2, Undo2 } from 'lucide-react';
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
  const eventUsesSlideshowOverride = Boolean(activeEvent?.settingsOverrides?.slideshow);
  const deviceMode = selectedDevice?.mode ?? null;
  const liveHint = targetType === 'global'
    ? eventUsesSlideshowOverride
      ? `Aktuell überlagert das Event „${activeEvent?.name}“ die globale Slideshow-Ausgabe.`
      : schedule?.autoPlay
        ? 'Die globale Slideshow wird im Auto-Play-Betrieb ausgespielt.'
        : 'Die globale Slideshow ist der Live-Stand für alle Geräte im Auto-Modus.'
    : deviceMode === 'override'
      ? eventUsesSlideshowOverride
        ? `Für ${selectedDevice?.name || 'dieses Gerät'} ist ein Override aktiv, wird aber momentan vom Event „${activeEvent?.name}“ überlagert.`
        : `Der veröffentlichte Override ist für ${selectedDevice?.name || 'dieses Gerät'} live aktiv.`
      : `Der veröffentlichte Override ist gespeichert, aber ${selectedDevice?.name || 'das Gerät'} steht auf Automatisch.`;

  return (
    <SectionCard
      title="Workflow & Live-Stand"
      description="Arbeite mit Entwürfen und veröffentliche nur bewusst den Live-Stand."
      icon={Layers}
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-spa-bg-secondary bg-spa-bg-primary/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-spa-text-secondary">Live</p>
              <h4 className="mt-1 text-sm font-semibold text-spa-text-primary">{targetLabel}</h4>
            </div>
            <StatusBadge
              label={targetType === 'global' ? 'Live global' : (deviceMode === 'override' ? 'Override live' : 'Override geparkt')}
              tone={targetType === 'global' ? 'success' : (deviceMode === 'override' ? 'info' : 'warning')}
              showDot={false}
            />
          </div>
          <div className="mt-4 space-y-2 text-sm text-spa-text-secondary">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              <span>{formatTimestamp(liveUpdatedAt)}</span>
            </div>
            {typeof liveSettingsVersion === 'number' && (
              <div className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <span>Settings-Version {liveSettingsVersion}</span>
              </div>
            )}
            <p className="rounded-lg bg-white/80 px-3 py-2 text-xs leading-relaxed text-spa-text-secondary">
              {liveHint}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-spa-bg-secondary bg-spa-bg-primary/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-spa-text-secondary">Entwurf</p>
              <h4 className="mt-1 text-sm font-semibold text-spa-text-primary">
                {draft ? 'Gespeicherter Zwischenstand' : 'Kein offener Entwurf'}
              </h4>
            </div>
            <StatusBadge
              label={draft ? 'Entwurf vorhanden' : 'Sauber'}
              tone={draft ? 'warning' : 'neutral'}
              showDot={false}
            />
          </div>
          <div className="mt-4 space-y-2 text-sm text-spa-text-secondary">
            <div className="flex items-center gap-2">
              <FileClock className="h-4 w-4" />
              <span>{draft ? formatTimestamp(draft.timestamp) : 'Nichts zwischengespeichert'}</span>
            </div>
            <div>
              {draft?.user ? `Von ${draft.user.username}` : 'Noch kein Entwurf gespeichert'}
            </div>
          </div>
          {draft && (
            <div className="mt-4">
              <Button
                variant="ghost"
                icon={Undo2}
                onClick={onDiscardDraft}
                disabled={disabled}
                loading={isWorking}
                loadingText="Verwerfe..."
              >
                Entwurf verwerfen
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-spa-bg-secondary bg-spa-bg-primary/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-spa-text-secondary">Live-Kontext</p>
              <h4 className="mt-1 text-sm font-semibold text-spa-text-primary">Was die Displays gerade priorisieren</h4>
            </div>
            <StatusBadge
              label={activeEvent ? 'Event aktiv' : (schedule?.autoPlay ? 'Auto-Play' : 'Kein Event')}
              tone={activeEvent ? 'info' : (schedule?.autoPlay ? 'success' : 'neutral')}
              showDot={false}
            />
          </div>
          <div className="mt-4 space-y-2 text-sm text-spa-text-secondary">
            <p>{activeEvent ? `Event: ${activeEvent.name}` : 'Es ist aktuell kein Event-Plan aktiv.'}</p>
            <p>{schedule?.autoPlay ? 'Aufgussplan läuft im Auto-Play-Modus.' : 'Aufgussplan ist manuell gesteuert.'}</p>
            {selectedDevice && (
              <p>
                Gerät {selectedDevice.name}: {selectedDevice.mode === 'override' ? 'Überschrieben' : 'Automatisch'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-spa-bg-secondary bg-spa-bg-primary/20">
        <div className="flex items-center gap-2 border-b border-spa-bg-secondary px-4 py-3">
          <History className="h-4 w-4 text-spa-text-secondary" />
          <h4 className="text-sm font-semibold text-spa-text-primary">Veröffentlichungen & Rücksprünge</h4>
        </div>
        {history.length === 0 ? (
          <div className="px-4 py-5 text-sm text-spa-text-secondary">
            Noch keine Veröffentlichungen oder Rollbacks für dieses Ziel vorhanden.
          </div>
        ) : (
          <div className="divide-y divide-spa-bg-secondary">
            {history.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-3 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={getHistoryLabel(entry)}
                      tone={entry.action === 'slideshow.rollback' ? 'warning' : 'success'}
                      showDot={false}
                    />
                    {entry.metadata.settingsVersion !== null && (
                      <StatusBadge label={`Version ${entry.metadata.settingsVersion}`} tone="neutral" showDot={false} />
                    )}
                  </div>
                  <div className="text-sm font-medium text-spa-text-primary">
                    {formatTimestamp(entry.timestamp)}
                  </div>
                  <div className="text-xs text-spa-text-secondary">
                    {entry.user ? `von ${entry.user.username}` : 'ohne Benutzerzuordnung'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    icon={RotateCcw}
                    onClick={() => onLoadHistoryEntry(entry)}
                    disabled={disabled}
                  >
                    Im Editor laden
                  </Button>
                  <Button
                    variant="secondary"
                    icon={Rocket}
                    onClick={() => onRollbackEntry(entry)}
                    disabled={disabled}
                    loading={isWorking}
                    loadingText="Stelle wieder her..."
                  >
                    Wiederherstellen
                  </Button>
                  <Button
                    variant="ghost"
                    icon={Trash2}
                    onClick={() => onDeleteHistoryEntry(entry)}
                    disabled={disabled}
                  >
                    Löschen
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
