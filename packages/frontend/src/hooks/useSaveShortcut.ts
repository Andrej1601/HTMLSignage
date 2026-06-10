import { useEffect, useRef } from 'react';

/**
 * Globaler Save-Shortcut: Strg+S (Win/Linux) bzw. Cmd+S (macOS).
 *
 * Verhindert das Browser-„Seite speichern"-Dialog und ruft stattdessen
 * den übergebenen Save-Handler auf, sofern `enabled` und `isDirty`
 * gesetzt sind. Bewusst nur ein Hotkey-Slot pro Page — wir wollen keine
 * Mod+S-Konflikte zwischen mehreren simultanen Editoren.
 *
 * Nimmt den Save-Handler per Ref entgegen, damit Re-Renders mit neuer
 * Closure den Listener nicht ständig re-binden — wichtig, da der
 * keydown-Handler global ist.
 */
export function useSaveShortcut(
  saveHandler: () => void,
  options: { enabled?: boolean; isDirty?: boolean } = {},
): void {
  const { enabled = true, isDirty = true } = options;

  // Refs entkoppeln Listener-Lifecycle vom Closure-Lifecycle.
  const handlerRef = useRef(saveHandler);
  const enabledRef = useRef(enabled);
  const dirtyRef = useRef(isDirty);

  useEffect(() => {
    handlerRef.current = saveHandler;
    enabledRef.current = enabled;
    dirtyRef.current = isDirty;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isModS =
        (event.ctrlKey || event.metaKey)
        && !event.altKey
        && !event.shiftKey
        && event.key.toLowerCase() === 's';
      if (!isModS) return;
      if (!enabledRef.current) return;
      // Verhindere Browser-Dialog auch dann, wenn nichts zu speichern
      // ist — sonst wäre das Verhalten verwirrend (mal kommt der
      // Browser-Dialog, mal nicht, abhängig vom Dirty-State).
      event.preventDefault();
      if (!dirtyRef.current) return;
      handlerRef.current();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
