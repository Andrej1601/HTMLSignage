import { useEffect } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';

interface UseUnsavedChangesGuardOptions {
  when: boolean;
  message: string;
}

export function useUnsavedChangesGuard({ when, message }: UseUnsavedChangesGuardOptions) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when
      && (
        currentLocation.pathname !== nextLocation.pathname
        || currentLocation.search !== nextLocation.search
        || currentLocation.hash !== nextLocation.hash
      ),
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      return;
    }

    if (window.confirm(message)) {
      blocker.proceed();
      return;
    }

    blocker.reset();
  }, [blocker, message]);

  useBeforeUnload((event) => {
    if (!when) return;
    event.preventDefault();
    event.returnValue = '';
  });
}
