import { EventType } from "../lib/supabase";

export function getEventTypeLabel(eventType?: EventType): { emoji: string; label: string } {
  switch (eventType) {
    case "birthday":
      return { emoji: "🎂", label: "Birthday" };
    case "wedding":
      return { emoji: "💍", label: "Wedding" };
    case "graduation":
      return { emoji: "🎓", label: "Graduation" };
    case "majlis":
      return { emoji: "☕", label: "Majlis" };
    case "istiraha":
      return { emoji: "🏕️", label: "Istiraha" };
    case "ramadan":
      return { emoji: "🌙", label: "Ramadan" };
    case "party":
    default:
      return { emoji: "🎉", label: "Party" };
  }
}
