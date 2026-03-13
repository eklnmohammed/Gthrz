import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "gthrz_recent_locations";
const MAX = 8;

function storageKey(phone: string | null): string {
  if (!phone || !phone.trim()) return KEY_PREFIX;
  const normalized = phone.replace(/\D/g, "").trim();
  return normalized ? `${KEY_PREFIX}:${normalized}` : KEY_PREFIX;
}

/**
 * Returns the last ~8 selected locations for the user (per phone).
 */
export async function getRecentLocations(phone: string | null): Promise<string[]> {
  try {
    const key = storageKey(phone);
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Adds a location to the front of the list, dedupes case-insensitively, trims to MAX entries.
 * Returns the updated list. Uses phone for per-user recents.
 */
export async function addRecentLocation(value: string, phone: string | null): Promise<string[]> {
  const trimmed = value.trim();
  if (!trimmed) return getRecentLocations(phone);
  try {
    const existing = await getRecentLocations(phone);
    const deduped = [
      trimmed,
      ...existing.filter((l) => l.toLowerCase() !== trimmed.toLowerCase()),
    ];
    const next = deduped.slice(0, MAX);
    await AsyncStorage.setItem(storageKey(phone), JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}
