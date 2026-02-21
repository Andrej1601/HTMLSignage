/**
 * Shared object utility functions used across multiple pages/components.
 */

/** Type guard: checks if a value is a non-null, non-array plain object. */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Deep-merges two plain records. Nested objects are merged recursively; other values are overwritten. */
export function deepMergeRecords(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (isPlainRecord(value) && isPlainRecord(merged[key])) {
      merged[key] = deepMergeRecords(merged[key] as Record<string, unknown>, value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}
