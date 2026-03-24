import clsx from 'clsx';

interface AutosaveIndicatorProps {
  isDirty: boolean;
  lastAutoSavedAt: Date | null;
  className?: string;
}

function formatSavedAt(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Gerade eben gesichert';
  if (diffMin === 1) return 'Vor 1 Min. gesichert';
  return `Vor ${diffMin} Min. gesichert`;
}

export function AutosaveIndicator({ isDirty, lastAutoSavedAt, className }: AutosaveIndicatorProps) {
  if (!isDirty && !lastAutoSavedAt) return null;

  return (
    <span
      className={clsx('inline-flex items-center gap-1.5 text-xs', className)}
      aria-live="polite"
      aria-label={isDirty ? 'Ungespeicherte Änderungen vorhanden' : 'Automatisch gesichert'}
    >
      <span
        className={clsx(
          'h-1.5 w-1.5 flex-shrink-0 rounded-full',
          isDirty ? 'bg-spa-warning animate-pulse' : 'bg-spa-success',
        )}
      />
      <span className={isDirty ? 'text-spa-warning-dark' : 'text-spa-text-secondary'}>
        {isDirty ? 'Nicht gespeichert' : lastAutoSavedAt ? formatSavedAt(lastAutoSavedAt) : null}
      </span>
    </span>
  );
}
