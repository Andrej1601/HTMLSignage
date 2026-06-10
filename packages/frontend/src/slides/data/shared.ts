/**
 * Shared helpers for headless slide-data hooks.
 *
 * Intentionally framework-free where possible — these are pure functions.
 * Hooks live in sibling files and compose them with `useMemo`.
 */
import type { SaunaAroma } from '@htmlsignage/design-sdk';
import type { Aroma, Settings } from '@/types/settings.types';
import type { Sauna } from '@/types/sauna.types';
import { normalizeSaunaNameKey } from '@/types/schedule.types';
import { getScentEmoji } from '@/components/Display/wellnessDisplayUtils';

/**
 * Resolve a sauna by id or name. Mirrors the lookup used across display
 * components: try id, then exact name, then normalized-name fallback.
 */
export function resolveSauna(
  saunas: Sauna[] | undefined,
  identifier: string | undefined,
): Sauna | undefined {
  if (!identifier || !saunas || saunas.length === 0) return undefined;
  const byId = saunas.find((s) => s.id === identifier);
  if (byId) return byId;
  const byName = saunas.find((s) => s.name === identifier);
  if (byName) return byName;
  const key = normalizeSaunaNameKey(identifier);
  return saunas.find((s) => normalizeSaunaNameKey(s.name) === key);
}

/**
 * Derive up to two short "badge" lines from a sauna description.
 * Matches the modern dashboard behavior.
 */
export function deriveInfoBadges(description: string | undefined | null, max = 2): string[] {
  if (!description) return [];
  return String(description)
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Remove legacy leading emoji/symbol from badge strings (e.g. "🌿 Birke" → "Birke").
 * Same normalization the dashboard performs on schedule entry badges.
 */
export function normalizeBadgeLabel(value: string): string {
  const s = String(value ?? '').trim();
  if (!s) return s;
  const parts = s.split(/\s+/);
  if (parts.length >= 2 && /^[^A-Za-z0-9ÄÖÜäöüß]+$/.test(parts[0] || '')) {
    return parts.slice(1).join(' ').trim();
  }
  return s;
}

function aromaKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Build typed `SaunaAroma[]` from raw badge strings. Looks up matching
 * entries in `settings.aromas` for emoji/color; falls back to a derived
 * emoji for unknown labels.
 */
export function buildAromas(
  rawBadges: Array<string | null | undefined> | undefined,
  aromas: Aroma[] | undefined,
): SaunaAroma[] {
  if (!rawBadges || rawBadges.length === 0) return [];

  const catalog = aromas ?? [];
  const result: SaunaAroma[] = [];

  rawBadges.forEach((raw, index) => {
    const label = normalizeBadgeLabel(String(raw ?? '')).trim();
    if (!label) return;
    const norm = aromaKey(label);
    const match = catalog.find((a) => {
      const key = aromaKey(a.name || '');
      return key && (norm === key || norm.includes(key));
    });
    result.push({
      id: match?.id ?? `aroma:${index}:${label}`,
      name: match?.name ?? label,
      emoji: match?.emoji ?? getScentEmoji(label, catalog),
      color: match?.color,
    });
  });

  return result;
}

/**
 * Clamp a "flame" intensity value to the 1–4 range, matching the display
 * dashboard behavior. Non-numeric inputs collapse to 1.
 */
export function clampIntensity(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(4, Math.max(1, Math.round(n)));
}

/**
 * Extract the relevant prestart-minutes setting from global settings,
 * with the same fallback semantics as `resolvePrestartMinutes`.
 */
export function readPrestartMinutes(settings: Settings | undefined, fallback = 10): number {
  const raw = settings?.display?.prestartMinutes;
  const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed)) return Math.min(120, Math.max(0, Math.round(fallback)));
  return Math.min(120, Math.max(0, Math.round(parsed)));
}
