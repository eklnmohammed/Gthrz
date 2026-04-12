import { colors } from "../theme/colors";
import { EventType } from "../lib/supabase";

export function getEventGradient(
  eventType?: EventType | null
): readonly [string, string, ...string[]] {
  switch (eventType) {
    case "birthday":
    case "party":
    case "rave":
    case "gathering":
    case "dinner":
      return [...colors.posterGradient2];
    case "wedding":
      return [...colors.posterGradient1];
    case "graduation":
      return [...colors.primaryGradient];
    default:
      return [...colors.primaryGradient];
  }
}
