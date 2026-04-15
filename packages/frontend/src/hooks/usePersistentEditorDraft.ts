import { useCallback, useEffect, useState } from 'react';

export interface EditorDraftRecord<TValue, TMeta = undefined> {
  version: 1;
  updatedAt: string;
  value: TValue;
  meta?: TMeta;
}

interface UsePersistentEditorDraftOptions<TValue, TMeta> {
  storageKey: string;
  value: TValue | null;
  meta?: TMeta;
  isDirty: boolean;
  enabled?: boolean;
  debounceMs?: number;
}

function readDraft<TValue, TMeta>(storageKey: string): EditorDraftRecord<TValue, TMeta> | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<EditorDraftRecord<TValue, TMeta>>;
    if (
      parsed?.version !== 1 ||
      typeof parsed.updatedAt !== 'string' ||
      !('value' in parsed)
    ) {
      return null;
    }

    return parsed as EditorDraftRecord<TValue, TMeta>;
  } catch {
    return null;
  }
}

export function usePersistentEditorDraft<TValue, TMeta = undefined>({
  storageKey,
  value,
  meta,
  isDirty,
  enabled = true,
  debounceMs = 500,
}: UsePersistentEditorDraftOptions<TValue, TMeta>) {
  const [availableDraft, setAvailableDraft] = useState<EditorDraftRecord<TValue, TMeta> | null>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<Date | null>(null);

  const [prevDraftKey, setPrevDraftKey] = useState<string | null>(enabled ? storageKey : null);
  const draftKey = enabled ? storageKey : null;
  if (prevDraftKey !== draftKey) {
    setPrevDraftKey(draftKey);
    setAvailableDraft(draftKey ? readDraft<TValue, TMeta>(draftKey) : null);
  }

  useEffect(() => {
    if (!enabled || !isDirty || value == null || typeof window === 'undefined') {
      return undefined;
    }

    const handle = window.setTimeout(() => {
      const record: EditorDraftRecord<TValue, TMeta> = {
        version: 1,
        updatedAt: new Date().toISOString(),
        value,
        meta,
      };

      try {
        window.localStorage.setItem(storageKey, JSON.stringify(record));
        setAvailableDraft(record);
        setLastAutoSavedAt(new Date());
      } catch {
        // Ignore storage failures; editing should keep working even without persistence.
      }
    }, debounceMs);

    return () => window.clearTimeout(handle);
  }, [debounceMs, enabled, isDirty, meta, storageKey, value]);

  const clearDraft = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }
    setAvailableDraft(null);
  }, [storageKey]);

  const restoreDraft = useCallback(() => {
    if (!availableDraft) return null;
    return availableDraft;
  }, [availableDraft]);

  return {
    availableDraft,
    hasStoredDraft: Boolean(availableDraft),
    draftUpdatedAt: availableDraft?.updatedAt || null,
    lastAutoSavedAt,
    restoreDraft,
    clearDraft,
  };
}
