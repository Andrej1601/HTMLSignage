/**
 * Versionskonflikt-Dialog: erscheint, wenn ein PATCH/PUT mit 409
 * abgelehnt wurde, weil zwischenzeitlich ein anderer Admin gespeichert
 * hat. Bietet drei Wege:
 *
 *  1. "Server-Stand übernehmen": eigene Änderungen verwerfen, Live-Daten
 *     laden — sicher und einfach.
 *  2. "Manuell prüfen": Dialog schließen, in den Editor zurückkehren —
 *     der User kann seine Eingaben mit dem Server-Stand vergleichen.
 *  3. "Meine Änderungen erzwingen": die lokale Version wird mit der
 *     neuesten Server-Version + 1 erneut hochgeladen. Achtung: andere
 *     Admin-Änderungen werden dabei überschrieben — bewusste Aktion.
 *
 * Die Komponente ist absichtlich generisch: sie nimmt keine Domain-
 * Kenntnis (Settings/Schedule), sondern nur Versionsnummern und
 * Callbacks. So lässt sie sich auf beiden Pages verwenden.
 */
import { AlertTriangle, RotateCcw, Save, Eye } from 'lucide-react';
import { Dialog } from '@/components/Dialog';
import { Button } from '@/components/Button';

interface VersionConflictDialogProps {
  isOpen: boolean;
  /** Domain-Label, z. B. "Einstellungen" oder "Aufgussplan". */
  entityLabel: string;
  /** Lokal bearbeiteter Stand (woraus der Save kam). */
  localVersion: number | null;
  /** Stand auf dem Server zum Zeitpunkt des Konflikts. */
  serverVersion: number | null;
  /** Optional: kurze Liste der lokal geänderten Felder/Bereiche. */
  changedAreas?: string[];
  /** Schließt den Dialog (Manuell-Prüfen-Pfad). */
  onClose: () => void;
  /** Verwirft lokale Änderungen, lädt Server-Stand. */
  onAcceptServer: () => void;
  /**
   * Speichert die lokale Version erneut, mit `serverVersion + 1` als
   * Versionsfeld — überschreibt die Server-Änderungen. Optional:
   * komponentenseitig kann geblockt werden, wenn nicht erlaubt.
   */
  onForceSave?: () => void;
  /** True während eines laufenden Force-Save-Requests. */
  isForcing?: boolean;
}

export function VersionConflictDialog({
  isOpen,
  entityLabel,
  localVersion,
  serverVersion,
  changedAreas,
  onClose,
  onAcceptServer,
  onForceSave,
  isForcing = false,
}: VersionConflictDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Versionskonflikt – ${entityLabel}`}
      size="md"
      closeDisabled={isForcing}
      footer={(
        <>
          <Button variant="ghost" icon={Eye} onClick={onClose} disabled={isForcing}>
            Manuell prüfen
          </Button>
          <Button
            variant="secondary"
            icon={RotateCcw}
            onClick={onAcceptServer}
            disabled={isForcing}
          >
            Server-Stand laden
          </Button>
          {onForceSave && (
            <Button
              variant="danger"
              icon={Save}
              onClick={onForceSave}
              loading={isForcing}
              loadingText="Erzwinge..."
            >
              Erzwingen
            </Button>
          )}
        </>
      )}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-spa-warning/40 bg-spa-warning-light px-4 py-3 text-sm text-spa-warning-dark">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              {entityLabel} wurden parallel verändert.
            </p>
            <p className="mt-1 leading-relaxed">
              Während du gearbeitet hast, hat ein anderer Admin (oder ein anderes
              Browser-Fenster) den Stand auf dem Server aktualisiert. Wenn du
              jetzt einfach speicherst, würden seine Änderungen überschrieben.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-spa-bg-secondary bg-spa-bg-primary/30 p-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-spa-text-secondary">
              Dein Stand basiert auf
            </p>
            <p className="mt-1 font-mono text-base font-bold text-spa-text-primary">
              v{localVersion ?? '?'}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-spa-text-secondary">
              Server ist jetzt
            </p>
            <p className="mt-1 font-mono text-base font-bold text-spa-warning-dark">
              v{serverVersion ?? '?'}
            </p>
          </div>
        </div>

        {changedAreas && changedAreas.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-spa-text-secondary mb-1.5">
              Deine lokalen Änderungen
            </p>
            <ul className="text-sm text-spa-text-primary list-disc list-inside space-y-0.5">
              {changedAreas.map((area) => (
                <li key={area}>{area}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2 text-sm text-spa-text-secondary">
          <p className="font-semibold text-spa-text-primary">Was möchtest du tun?</p>
          <ul className="space-y-1.5 list-none">
            <li>
              <strong className="text-spa-text-primary">Manuell prüfen</strong> —
              Dialog schließen, lokale Änderungen vor Augen behalten und gegen
              den Server-Stand abgleichen (Tipp: in einem zweiten Tab Live-Daten
              ansehen).
            </li>
            <li>
              <strong className="text-spa-text-primary">Server-Stand laden</strong> —
              Lokale Änderungen verwerfen und mit der aktuellen Server-Version
              weiterarbeiten. Sicher, aber deine Eingaben sind weg.
            </li>
            {onForceSave && (
              <li>
                <strong className="text-spa-error">Erzwingen</strong> —
                Deine Version wird mit Versionsnummer {serverVersion != null ? `v${serverVersion + 1}` : 'höher'} hochgeladen
                und überschreibt die parallelen Änderungen auf dem Server.
                Nur wählen, wenn du sicher bist, dass deine Änderungen Vorrang haben.
              </li>
            )}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}
