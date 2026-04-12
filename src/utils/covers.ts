import type { EventType } from "../lib/supabase";
import { COVER_SOURCES } from "./covers.generated";

const VALID_EVENT_TYPES: EventType[] = [
  "party",
  "rave",
  "gathering",
  "birthday",
  "dinner",
  "wedding",
  "graduation",
];

/** Prefix in assets/covers/ (e.g. dinner_1.png → family "dinner"). */
type CoverAssetFamily =
  | "party"
  | "birthday"
  | "wedding"
  | "graduation"
  | "dinner"
  | "gathering"
  | "rave";

function coverAssetFamily(eventType: EventType): CoverAssetFamily {
  switch (eventType) {
    case "birthday":
      return "birthday";
    case "wedding":
      return "wedding";
    case "graduation":
      return "graduation";
    case "dinner":
      return "dinner";
    case "gathering":
      return "gathering";
    case "rave":
      return "rave";
    case "party":
    default:
      return "party";
  }
}

function pickDefaultKeyForFamily(family: CoverAssetFamily): string {
  if (family === "party") {
    return COVER_SOURCES["party_2"] !== undefined ? "party_2" : "party_1";
  }
  const first = `${family}_1`;
  if (COVER_SOURCES[first] !== undefined) return first;
  return COVER_SOURCES["party_2"] !== undefined ? "party_2" : "party_1";
}

/**
 * Default cover key when no custom cover is set.
 * When `eventType` is null/unknown, uses generic party family preset (not tied to a selected category).
 */
export function getDefaultCoverKey(eventType?: EventType | null): string {
  if (eventType == null || !VALID_EVENT_TYPES.includes(eventType)) {
    return pickDefaultKeyForFamily("party");
  }
  return pickDefaultKeyForFamily(coverAssetFamily(eventType));
}

function safeEventType(eventType?: EventType | null): EventType | null {
  return eventType != null && VALID_EVENT_TYPES.includes(eventType) ? eventType : null;
}

/**
 * Cover options for the given event type. Returns only keys that exist in COVER_SOURCES
 * for the mapped asset family, sorted by number (1, 2, 3, …). Covers are auto-discovered from assets/covers/
 * (run `node scripts/generate-covers.js` or `npm run generate-covers` after adding images).
 */
export function getCoverOptions(eventType?: EventType | null): { key: string; label: string }[] {
  const st = safeEventType(eventType);
  const family = st == null ? "party" : coverAssetFamily(st);
  const prefix = `${family}_`;
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
  const hasValidKey =
    coverKey != null &&
    typeof coverKey === "string" &&
    coverKey.trim() !== "" &&
    COVER_SOURCES[coverKey] !== undefined;
  const key = hasValidKey ? coverKey : getDefaultCoverKey(eventType);
  return COVER_SOURCES[key] ?? COVER_SOURCES[getDefaultCoverKey(eventType)];
}
