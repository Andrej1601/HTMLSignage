import { AlertTriangle, History, RotateCcw } from 'lucide-react';
import { Button } from '@/components/Button';
import { formatRelativeTime, toValidDate } from '@/utils/dateUtils';

interface DraftRecoveryBannerProps {
  mode: 'available' | 'restored';
  entityLabel: string;
  updatedAt?: string | null;
  onRestore?: () => void;
  onDiscard: () => void;
}

export function DraftRecoveryBanner({
  mode,
  entityLabel,
  updatedAt,
  onRestore,
  onDiscard,
}: DraftRecoveryBannerProps) {
  const relativeTime = updatedAt ? formatRelativeTime(toValidDate(updatedAt)) : 'vor kurzem';

  if (mode === 'restored') {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-spa-info/25 bg-spa-info-light/70 px-5 py-4 text-sm text-spa-info-dark md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <History className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">{entityLabel} aus lokalem Entwurf wiederhergestellt</p>
            <p className="mt-1 leading-relaxed">
              Der zuletzt gesicherte Stand von {relativeTime} ist jetzt aktiv. Er bleibt lokal, bis du speicherst oder bewusst zum Live-Stand zurückkehrst.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onDiscard}>
          Live-Stand laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-spa-warning/30 bg-spa-warning-light px-5 py-4 text-sm text-spa-warning-dark md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <div>
          <p className="font-semibold">Lokaler Entwurf für {entityLabel} gefunden</p>
          <p className="mt-1 leading-relaxed">
            Es gibt einen nicht veröffentlichten Stand von {relativeTime}. Du kannst ihn wiederherstellen oder verwerfen und beim Live-Stand bleiben.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {onRestore && (
          <Button size="sm" onClick={onRestore}>
            Entwurf wiederherstellen
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDiscard}>
          Entwurf verwerfen
        </Button>
      </div>
    </div>
  );
}
