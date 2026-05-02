/** Prototype upper bound for guest limit (create/edit validation only). */
export const MAX_EVENT_CAPACITY = 999;

/**
 * True when the value is a non-empty string of digits representing an integer from 1 to {@link MAX_EVENT_CAPACITY}.
 * Rejects: empty, abc, "10 people", decimals, negatives, zero, values above max.
 */
export function isValidPositiveWholeCapacityString(capacity: string): boolean {
  return getEventCapacityFormErrorMessage(capacity) === null;
}

/**
 * Returns a host-facing validation message when "Set limit" mode has an invalid value, or null if valid.
 */
export function getEventCapacityFormErrorMessage(capacity: string): string | null {
  const t = capacity.trim();
  if (t === "") return "Enter a whole number from 1 to 999.";
  if (!/^\d+$/.test(t)) return "Enter a whole number from 1 to 999.";
  const n = Number(t);
  if (!Number.isFinite(n) || n < 1) return "Enter a whole number from 1 to 999.";
  if (n > MAX_EVENT_CAPACITY) return "Capacity cannot be greater than 999.";
  return null;
}
