import AsyncStorage from "@react-native-async-storage/async-storage";
import { EventType } from "../lib/supabase";

// ─── Schema ──────────────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 1;

interface PreferenceSignal {
  eventType: EventType;
  weight: number;    // 1 = view, 2 = rsvp maybe, 3 = join code, 4 = rsvp going
  timestamp: number; // Date.now()
}

interface PreferenceStore {
  schemaVersion: typeof SCHEMA_VERSION;
  signals: PreferenceSignal[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DECAY_FACTOR = 0.85;      // applied per week
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MAX_SIGNAL_AGE_WEEKS = 12; // prune signals older than this

/** Minimum score required for a type to affect recommendations (e.g. reorder Discover, show "Recommended" on Home). */
export const PREFERENCE_THRESHOLD = 1.5;

const VALID_TYPES = new Set<EventType>([
  "party",
  "rave",
  "gathering",
  "birthday",
  "dinner",
  "wedding",
  "graduation",
]);

// ─── Storage helpers ──────────────────────────────────────────────────────────

/** Per-user key so preferences don't leak between accounts on the same device. */
function storageKey(phone: string): string {
  const sanitized = phone.replace(/\D/g, "");
  return sanitized ? `gthrz_event_preferences:${sanitized}` : "gthrz_event_preferences:anon";
}

async function loadStore(phone: string): Promise<PreferenceStore> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(phone));
    if (!raw) return { schemaVersion: SCHEMA_VERSION, signals: [] };
    const parsed = JSON.parse(raw);
    // Unrecognised schema → start fresh (forward-compat safety)
    if (parsed?.schemaVersion !== SCHEMA_VERSION) {
      return { schemaVersion: SCHEMA_VERSION, signals: [] };
    }
    return parsed as PreferenceStore;
  } catch {
    return { schemaVersion: SCHEMA_VERSION, signals: [] };
  }
}

async function saveStore(phone: string, store: PreferenceStore): Promise<void> {
  await AsyncStorage.setItem(storageKey(phone), JSON.stringify(store));
}

// ─── Core write ───────────────────────────────────────────────────────────────

async function addSignal(eventType: EventType, weight: number, phone: string): Promise<void> {
  if (!VALID_TYPES.has(eventType)) return; // silently drop unknown types
  const store = await loadStore(phone);
  store.signals.push({ eventType, weight, timestamp: Date.now() });
  // Prune signals older than MAX_SIGNAL_AGE_WEEKS to keep storage lean
  const cutoff = Date.now() - MAX_SIGNAL_AGE_WEEKS * MS_PER_WEEK;
  store.signals = store.signals.filter((s) => s.timestamp >= cutoff);
  await saveStore(phone, store);
}

// ─── Public signal recorders ──────────────────────────────────────────────────

/** +1 — user opened an event card from Discover. */
export async function recordEventView(eventType: EventType, phone: string): Promise<void> {
  await addSignal(eventType, 1, phone).catch(() => {});
}

/** +4 going / +2 maybe — user submitted an RSVP. */
export async function recordRsvp(
  eventType: EventType,
  status: "going" | "maybe",
  phone: string
): Promise<void> {
  await addSignal(eventType, status === "going" ? 4 : 2, phone).catch(() => {});
}

/** +3 — user joined an event using an invite code. */
export async function recordJoinWithCode(eventType: EventType, phone: string): Promise<void> {
  await addSignal(eventType, 3, phone).catch(() => {});
}

/** +2.5 — user favorited an event (small but meaningful boost for recommendations). */
export async function recordFavorite(eventType: EventType, phone: string): Promise<void> {
  await addSignal(eventType, 2.5, phone).catch(() => {});
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Returns a score per event type, computed as:
 *   score += weight × 0.85^(weeks_since_signal)
 * Types with no signals are absent from the result.
 */
export async function getPreferenceScores(
  phone: string
): Promise<Partial<Record<EventType, number>>> {
  const store = await loadStore(phone).catch(() => ({ schemaVersion: SCHEMA_VERSION, signals: [] } as PreferenceStore));
  const now = Date.now();
  const scores: Partial<Record<EventType, number>> = {};
  for (const signal of store.signals) {
    if (!VALID_TYPES.has(signal.eventType)) continue;
    const weeksAgo = (now - signal.timestamp) / MS_PER_WEEK;
    const decayed = signal.weight * Math.pow(DECAY_FACTOR, weeksAgo);
    scores[signal.eventType] = (scores[signal.eventType] ?? 0) + decayed;
  }
  return scores;
}

/**
 * Returns the top N event types ranked by preference score, only including types
 * with score >= PREFERENCE_THRESHOLD. Returns fewer than N if the user has fewer
 * types that meet the threshold.
 */
export async function getTopPreferencedTypes(phone: string, n = 2): Promise<EventType[]> {
  const scores = await getPreferenceScores(phone);
  return (Object.entries(scores) as [EventType, number][])
    .filter(([, score]) => score >= PREFERENCE_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([type]) => type);
}

/** Returns the single highest-scored type, or null if none has score >= PREFERENCE_THRESHOLD. */
export async function getPreferredEventType(phone: string): Promise<EventType | null> {
  const types = await getTopPreferencedTypes(phone, 1);
  return types[0] ?? null;
}

/** Clears preference data for the given phone. Call on sign out so the next account doesn't see old recommendations. */
export async function clearPreferencesForPhone(phone: string): Promise<void> {
  const key = storageKey(phone);
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Clears the preference learning store (same key as getPreferenceScores). For debug / reset recommendations. */
export async function clearPreferences(phone: string): Promise<void> {
  return clearPreferencesForPhone(phone);
}
