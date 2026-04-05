import { useCallback } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';

interface UseUnsavedChangesGuardOptions {
  when: boolean;
  message?: string;
}

interface UnsavedChangesGuard {
  /** Whether the styled confirm dialog is currently open */
  isBlocked: boolean;
  /** Call to proceed with navigation (leave page) */
  proceed: () => void;
  /** Call to cancel navigation (stay on page) */
  reset: () => void;
}

export function useUnsavedChangesGuard({
  when,
  message: _message,
}: UseUnsavedChangesGuardOptions): UnsavedChangesGuard {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when
      && (
        currentLocation.pathname !== nextLocation.pathname
        || currentLocation.search !== nextLocation.search
        || currentLocation.hash !== nextLocation.hash
      ),
  );

  const isBlocked = blocker.state === 'blocked';

  const proceed = useCallback(() => {
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  }, [blocker]);

  const reset = useCallback(() => {
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [blocker]);

  useBeforeUnload((event) => {
    if (!when) return;
    event.preventDefault();
    event.returnValue = '';
  });

  return { isBlocked, proceed, reset };
}
