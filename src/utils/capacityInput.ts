/**
 * True when the value is a non-empty string of digits representing an integer > 0.
 * Rejects: empty, abc, "10 people", decimals, negatives, zero.
 */
export function isValidPositiveWholeCapacityString(capacity: string): boolean {
  const t = capacity.trim();
  if (t === "") return false;
  if (!/^\d+$/.test(t)) return false;
  const n = Number(t);
  return Number.isFinite(n) && n > 0;
}
