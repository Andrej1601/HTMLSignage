const CHUNK_RECOVERY_STORAGE_KEY = 'htmlsignage:chunk-recovery-attempt';
const INSTALL_FLAG = '__htmlsignageChunkRecoveryInstalled';

function getErrorMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  if (value && typeof value === 'object' && 'message' in value && typeof (value as { message?: unknown }).message === 'string') {
    return (value as { message: string }).message;
  }
  return String(value ?? '');
}

export function isChunkLoadFailure(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /ChunkLoadError/i.test(message) ||
    /Expected a JavaScript-or-Wasm module script/i.test(message)
  );
}

function getCurrentAttemptKey(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function reloadForChunkFailure(message: string): boolean {
  try {
    const attemptKey = getCurrentAttemptKey();
    const previousAttempt = window.sessionStorage.getItem(CHUNK_RECOVERY_STORAGE_KEY);

    if (previousAttempt === attemptKey) {
      return false;
    }

    window.sessionStorage.setItem(CHUNK_RECOVERY_STORAGE_KEY, attemptKey);
  } catch {
    // Ignore sessionStorage failures and still reload below.
  }

  console.warn('[chunkRecovery] Reloading app after chunk load failure:', message);
  window.location.reload();
  return true;
}

export function clearChunkRecoveryAttempt(): void {
  try {
    window.sessionStorage.removeItem(CHUNK_RECOVERY_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function installChunkLoadRecovery(): void {
  if (typeof window === 'undefined') return;

  const flagCarrier = window as Window & { [INSTALL_FLAG]?: boolean };
  if (flagCarrier[INSTALL_FLAG]) return;
  flagCarrier[INSTALL_FLAG] = true;

  window.addEventListener('error', (event) => {
    const message = getErrorMessage(event.error || event.message);
    if (!isChunkLoadFailure(message)) return;
    event.preventDefault();
    reloadForChunkFailure(message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const message = getErrorMessage(event.reason);
    if (!isChunkLoadFailure(message)) return;
    event.preventDefault();
    reloadForChunkFailure(message);
  });

  window.addEventListener('vite:preloadError', (event: Event) => {
    const customEvent = event as CustomEvent<unknown>;
    const message = getErrorMessage(customEvent.detail);
    if (!isChunkLoadFailure(message)) return;
    event.preventDefault?.();
    reloadForChunkFailure(message);
  });
}
