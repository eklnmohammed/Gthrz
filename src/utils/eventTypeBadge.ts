import { EventType } from "../lib/supabase";

/** Empty `label` when the host did not set a category (cards/details hide the chip). */
export function getEventTypeLabel(eventType?: EventType | null): { label: string } {
  if (eventType == null) return { label: "" };
  switch (eventType) {
    case "rave":
      return { label: "Rave" };
    case "gathering":
      return { label: "Gathering" };
    case "birthday":
      return { label: "Birthday" };
    case "dinner":
      return { label: "Dinner" };
    case "wedding":
      return { label: "Wedding" };
    case "graduation":
      return { label: "Graduation" };
    case "party":
    default:
      return { label: "Party" };
  }
}
