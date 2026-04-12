import type { ImageSourcePropType } from "react-native";
import type { EventType } from "../lib/supabase";
import { isValidCoverUrl } from "./coverUrl";
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

/** Before an event type is chosen, avoid party/rave imagery — prefer calm “gathering” stock, then safe fallbacks. */
function pickNeutralDefaultKey(): string {
  const candidates = ["gathering_1", "gathering_2", "dad", "ghabga_1"];
  for (const k of candidates) {
    if (COVER_SOURCES[k] !== undefined) return k;
  }
  return pickDefaultKeyForFamily("party");
}

/**
 * Default cover key when no custom cover is set.
 * When `eventType` is null/unknown, uses a neutral preset (not party/nightlife-specific).
 */
export function getDefaultCoverKey(eventType?: EventType | null): string {
  if (eventType == null || !VALID_EVENT_TYPES.includes(eventType)) {
    return pickNeutralDefaultKey();
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
  // No type yet: show gathering-family covers in the picker (neutral), not party thumbnails.
  const family = st == null ? "gathering" : coverAssetFamily(st);
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

/**
 * Cover image for the Create/Edit event hero, or `null` for the branded abstract default
 * (no event type yet, no custom URL, no explicitly chosen preset key).
 */
export function getEventFormHeroCoverSource(
  coverUrl: string | null | undefined,
  coverKey: string | null | undefined,
  eventType: EventType | null | undefined
): ImageSourcePropType | null {
  if (isValidCoverUrl(coverUrl)) {
    return { uri: coverUrl!.trim() };
  }
  const keyTrim = (coverKey ?? "").trim();
  const st = safeEventType(eventType);
  if (st != null) {
    return getCoverSource(keyTrim || undefined, st);
  }
  if (keyTrim !== "" && COVER_SOURCES[keyTrim] !== undefined) {
    return COVER_SOURCES[keyTrim];
  }
  return null;
}
