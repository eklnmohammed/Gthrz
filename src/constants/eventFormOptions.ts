import type { EventType } from "@/src/lib/supabase";
import { getEventTypeLabel } from "@/src/utils/eventTypeBadge";

/**
 * Final Create/Edit event type list (order = chip order on Create, Edit, and cover modal).
 * Type is optional in the form; this is the list when the user selects one.
 * Must match `EventType` in `src/lib/supabase.ts`.
 */
export const CREATE_EDIT_EVENT_TYPE_ORDER = [
  "party",
  "rave",
  "gathering",
  "birthday",
  "dinner",
  "wedding",
  "graduation",
] as const satisfies readonly EventType[];

/** Labels from `getEventTypeLabel` — shared by Create/Edit hero chips and cover type row. */
export const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] =
  CREATE_EDIT_EVENT_TYPE_ORDER.map((value) => ({
    value,
    label: getEventTypeLabel(value).label,
  }));

export const BRING_SUGGESTIONS = ["Drinks", "Chips", "Chocolate", "Coffee", "Water"];
