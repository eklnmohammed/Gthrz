import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = `Missing Supabase environment variables:
  - EXPO_PUBLIC_SUPABASE_URL: ${supabaseUrl || "NOT SET"}
  - EXPO_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? "SET" : "NOT SET"}

  Make sure:
  1. .env file exists in project root
  2. Variables are named EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
  3. No quotes around values
  4. URL starts with https://
  5. Restart with: npx expo start -c`;

  console.error(errorMsg);
  throw new Error(errorMsg);
}

// Validate URL format
if (!supabaseUrl.startsWith("https://") && !supabaseUrl.startsWith("http://")) {
  const errorMsg = `Invalid Supabase URL: "${supabaseUrl}"
  URL must start with https:// (e.g., https://your-project.supabase.co)`;

  console.error(errorMsg);
  throw new Error(errorMsg);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type EventType =
  | "party"
  | "rave"
  | "gathering"
  | "birthday"
  | "dinner"
  | "wedding"
  | "graduation";

const EVENT_TYPES: EventType[] = [
  "party",
  "rave",
  "gathering",
  "birthday",
  "dinner",
  "wedding",
  "graduation",
];

export function isEventType(value: string | null | undefined): value is EventType {
  return value != null && (EVENT_TYPES as string[]).includes(value);
}

/**
 * Map DB `event_type` to app `EventType`, or null when unset / empty.
 * Legacy strings map into the current seven-type set (e.g. engagement → wedding).
 */
export function normalizeEventType(raw: string | null | undefined): EventType | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  if (isEventType(s)) return s;
  if (s === "majlis" || s === "istiraha") return "gathering";
  if (s === "ramadan") return "rave";
  if (s === "celebration") return "party";
  if (s === "engagement") return "wedding";
  return "party";
}

export type EndDayOffset = 0 | 1;

export interface LineupEntry {
  name: string;
  startTime?: string;
  endTime?: string;
  endDayOffset?: EndDayOffset;
  note?: string;
}

export interface Event {
  id: string;
  title: string;
  date_time: string;
  location: string | null;
  details: string | null;
  capacity: number | null;
  visibility: "public" | "private";
  approval_required?: boolean;
  host_phone: string | null;
  host_name: string | null;
  /** Raw DB value; null = host chose no category. Legacy strings — use `normalizeEventType`. */
  event_type: string | null;
  invite_code: string | null;
  cover_key: string | null;
  cover_url: string | null;
  lineup: LineupEntry[] | null;
  created_at: string;
  /** "now" | "reveal" – when to show location to guests */
  location_visibility?: string | null;
  /** Hours before event to reveal location (only if location_visibility === "reveal") */
  reveal_hours_before?: number | null;
  /** Structured location fields (Nominatim / manual) */
  location_name?: string | null;
  location_address?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  /** When true, guest users see avatars/initials but not names */
  hide_guest_names?: boolean | null;
  /** When true, guest users see a placeholder instead of other guests' avatars */
  hide_guest_avatars?: boolean | null;
  /** Event lifecycle status – 'active' (default) or 'cancelled' */
  status?: "active" | "cancelled" | null;
  /** Optional reason when event was cancelled (visible to guests) */
  cancellation_reason?: string | null;
  /** Optional dress code specified by the host */
  dress_code?: string | null;
  /** Optional audience type: mixed, men, women */
  audience?: string | null;
  /** Whether guests can bring a +1 */
  allow_plus_one?: boolean | null;
  /** "free" or "paid" */
  price_mode?: "free" | "paid" | null;
  /** Amount (only relevant when price_mode === "paid") */
  price_amount?: number | null;
  /** Currency symbol or code: "SAR", "$", "£" */
  price_currency?: string | null;
  /** Who can see exact location: "all_viewers" or "going_only" (default) */
  location_exact_audience?: "all_viewers" | "going_only" | null;
}

export interface Rsvp {
  id: string;
  event_id: string;
  user_phone: string;
  status: "going" | "maybe" | "cant" | "pending";
  plus_one?: boolean;
  declined_by_host?: boolean;
  created_at: string;
}

export interface EventContribution {
  id: string;
  event_id: string;
  title: string;
  assigned_user_phone: string | null;
  status: "open" | "done";
  created_at: string;
}

