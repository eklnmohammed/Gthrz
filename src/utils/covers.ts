import type { EventType } from "../lib/supabase";
import { COVER_SOURCES } from "./covers.generated";

const VALID_EVENT_TYPES: EventType[] = [
  "party", "birthday", "wedding", "graduation", "majlis", "istiraha", "ramadan",
];

/**
 * Default cover key for an event type (e.g. "party_2").
 * Party uses _2 so the first preset is not the default.
 * Always falls back to party so cover selection never breaks.
 */
export function getDefaultCoverKey(eventType?: EventType | null): string {
  const safe =
    eventType && VALID_EVENT_TYPES.includes(eventType) ? eventType : "party";
  if (safe === "party") return "party_2";
  return `${safe}_1`;
}

function safeEventType(eventType?: EventType | null): EventType {
  return eventType && VALID_EVENT_TYPES.includes(eventType) ? eventType : "party";
}

/**
 * Cover options for the given event type. Returns only keys that exist in COVER_SOURCES
 * for that type, sorted by number (1, 2, 3, …). Covers are auto-discovered from assets/covers/
 * (run "npm start" to regenerate after adding new images).
 */
export function getCoverOptions(eventType?: EventType | null): { key: string; label: string }[] {
  const type = safeEventType(eventType);
  const prefix = `${type}_`;
  const keys = Object.keys(COVER_SOURCES)
    .filter((k) => k.startsWith(prefix))
    .map((k) => {
      const num = parseInt(k.slice(prefix.length), 10);
      return { key: k, num: Number.isNaN(num) ? 0 : num };
    })
    .sort((a, b) => a.num - b.num);
  return keys.map(({ key, num }) => ({ key, label: `Cover ${num}` }));
}

/**
 * Returns the require() source for the given cover key.
 * Uses coverKey when it is present and exists in COVER_SOURCES; otherwise falls back to default for eventType.
 */
export function getCoverSource(
  coverKey: string | undefined,
  eventType?: EventType | null
): number {
  const type = safeEventType(eventType);
  const hasValidKey =
    coverKey != null &&
    typeof coverKey === "string" &&
    coverKey.trim() !== "" &&
    COVER_SOURCES[coverKey] !== undefined;
  const key = hasValidKey ? coverKey : getDefaultCoverKey(type);
  return COVER_SOURCES[key] ?? COVER_SOURCES[getDefaultCoverKey(type)];
}
