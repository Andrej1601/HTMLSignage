export function toFiniteNumber(value){
  if (value == null) return null;
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (normalized === '') return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}
