import { useEffect, useState } from 'react';
import type { Design } from '@htmlsignage/design-sdk';
import { type DesignId, loadDesign } from './registry';

/**
 * In-memory cache so switching designs (or re-mounting the host) doesn't
 * re-fetch the pack. Cache is keyed by design id; values are resolved
 * Design objects. Failed loads are **not** cached — callers can retry.
 */
const designCache = new Map<DesignId, Design>();

interface DesignState {
  id: DesignId;
  design: Design | null;
  loading: boolean;
  error: Error | null;
}

export interface UseDesignResult {
  /** Fully validated, compatible design pack — or `null` while loading. */
  design: Design | null;
  /** True until the first load attempt completes (success or error). */
  loading: boolean;
  /** Structured error if loading or validation failed. */
  error: Error | null;
}

function initialStateFor(id: DesignId): DesignState {
  const cached = designCache.get(id) ?? null;
  return { id, design: cached, loading: cached === null, error: null };
}

/**
 * Asynchronously resolve a design pack by id.
 *
 * On success `design` is populated; on failure `error` is set and the
 * host falls back to the legacy renderer path. While loading both are
 * `null` and `loading` is `true`.
 */
export function useDesign(id: DesignId): UseDesignResult {
  const [state, setState] = useState<DesignState>(() => initialStateFor(id));

  // Reset state synchronously on id change — derived from props, not an effect.
  // See: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (state.id !== id) {
    setState(initialStateFor(id));
  }

  useEffect(() => {
    if (designCache.has(id)) return;

    let cancelled = false;

    loadDesign(id)
      .then((resolved) => {
        if (cancelled) return;
        designCache.set(id, resolved);
        setState((prev) =>
          prev.id === id ? { ...prev, design: resolved, loading: false, error: null } : prev,
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const wrapped = err instanceof Error ? err : new Error(String(err));
        setState((prev) =>
          prev.id === id ? { ...prev, design: null, loading: false, error: wrapped } : prev,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { design: state.design, loading: state.loading, error: state.error };
}
