/**
 * Shared object utility functions for the backend.
 * Mirrors the structure of the frontend's objectUtils.ts.
 */

/** Type guard: checks if a value is a non-null, non-array plain object. */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Deep-merges two values. Nested plain objects are merged recursively; other values are overwritten. */
export function deepMerge(base: unknown, override: unknown): unknown {
  if (!isPlainRecord(base)) return override;
  if (!isPlainRecord(override)) return base;

  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (isPlainRecord(value) && isPlainRecord(merged[key])) {
      merged[key] = deepMerge(merged[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}
