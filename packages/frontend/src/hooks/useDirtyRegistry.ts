/**
 * Minimaler globaler Dirty-State-Registry.
 *
 * Pages, die einen lokalen `isDirty`-State haben, registrieren sich
 * hier. `hasAnyDirty()` kann dann von Stellen geprüft werden, die
 * außerhalb der Page leben — z. B. der Logout-Button im Layout.
 *
 * Das ist eine pragmatische Lücke zwischen „echtem" UnsavedChangesContext
 * (Sprint D, mit Subscriber-API + automatischer Modal-Integration) und
 * der vorherigen Lösung (gar kein Schutz auf Logout). Bewusst klein:
 * eine Modul-Map plus ein Hook der den Status sync hält.
 */
import { useEffect, useRef } from 'react';

const dirtySet = new Set<string>();
let nextId = 0;

/**
 * Registriert die Dirty-Flag der aufrufenden Komponente. Beim Unmount
 * wird der Eintrag automatisch entfernt.
 */
export function useDirtyRegistry(isDirty: boolean): void {
  const idRef = useRef<string | null>(null);
  if (idRef.current === null) idRef.current = `dirty-${nextId++}`;

  useEffect(() => {
    const id = idRef.current!;
    if (isDirty) dirtySet.add(id);
    else dirtySet.delete(id);
    return () => {
      dirtySet.delete(id);
    };
  }, [isDirty]);
}

/** True wenn irgendeine Page aktuell ungespeicherte Änderungen hat. */
export function hasAnyDirty(): boolean {
  return dirtySet.size > 0;
}
