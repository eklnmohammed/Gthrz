import type { EventType } from "@/src/lib/supabase";

/** Canonical event type chips — shared by Create and Edit event screens. */
export const EVENT_TYPE_OPTIONS: { value: EventType; label: string; emoji: string }[] = [
  { value: "party", label: "Party", emoji: "🎉" },
  { value: "birthday", label: "Birthday", emoji: "🎂" },
  { value: "wedding", label: "Wedding", emoji: "💍" },
  { value: "graduation", label: "Graduation", emoji: "🎓" },
  { value: "majlis", label: "Majlis", emoji: "☕" },
  { value: "istiraha", label: "Istiraha", emoji: "🏕️" },
  { value: "ramadan", label: "Ramadan", emoji: "🌙" },
];

export const BRING_SUGGESTIONS = ["Drinks", "Chips", "Chocolate", "Coffee", "Water"];
