import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/Button';

interface StaleVersionBannerProps {
  /** Domain label – z.B. "Einstellungen" oder "Saunen". */
  entityLabel: string;
  /** Server-seitige Version, die neuer ist als der lokale Stand. */
  serverVersion?: number | null;
  /** Lokale (im Editor sichtbare) Version. */
  localVersion?: number | null;
  /**
   * Lädt die Live-Daten und verwirft die ungespeicherten Änderungen.
   * Sollte den Banner zum Verschwinden bringen (Reset des Versions-State).
   */
  onReload: () => void;
  /**
   * Banner-Hinweis weiter ignorieren — der User behält seine Änderungen.
   * Beim Speichern landet er dann ggf. auf einem 409-Konflikt-Pfad.
   */
  onDismiss: () => void;
}

/**
 * Wird sichtbar, wenn ein anderer Admin parallel gespeichert hat,
 * während der User noch lokale Änderungen offen hat.
 *
 * Verhalten:
 * - Banner ist eine Warnung, kein Modal — der User kann weiter editieren.
 * - "Neu laden" verwirft die lokalen Änderungen explizit.
 * - "Ignorieren" blendet nur den Banner aus; der Versionskonflikt
 *   wird beim nächsten Speichern serverseitig erkannt.
 */
export function StaleVersionBanner({
  entityLabel,
  serverVersion,
  localVersion,
  onReload,
  onDismiss,
}: StaleVersionBannerProps) {
  const versionHint =
    typeof serverVersion === 'number' && typeof localVersion === 'number'
      ? ` (v${localVersion} → v${serverVersion})`
      : '';

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-2xl border-2 border-spa-warning bg-spa-warning-light px-5 py-4 text-sm text-spa-warning-dark md:flex-row md:items-center md:justify-between"
    >
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{entityLabel} wurden in der Zwischenzeit aktualisiert{versionHint}</p>
          <p className="mt-1 leading-relaxed">
            Ein anderer Admin (oder ein anderes Gerät) hat parallel gespeichert.
            Wenn du jetzt speicherst, kann es zu einem Versionskonflikt kommen — du kannst neu laden,
            um auf den aktuellen Stand zu wechseln. Dabei gehen deine lokalen Änderungen verloren.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={RefreshCw} onClick={onReload}>
          Neu laden
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Ignorieren
        </Button>
      </div>
    </div>
  );
}
