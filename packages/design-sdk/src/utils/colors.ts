/**
 * Convert a `#rrggbb` / `#rgb` hex colour to an `rgba()` string with the
 * given alpha. Non-hex inputs (named colours, `rgb(...)`, `oklch(...)`)
 * are returned unchanged so they pass through CSS untouched.
 */
export function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  const clamped = Math.max(0, Math.min(1, alpha));
  if (!c.startsWith('#')) return c;
  const raw = c.slice(1);
  const hex = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw;
  if (hex.length !== 6) return c;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}
