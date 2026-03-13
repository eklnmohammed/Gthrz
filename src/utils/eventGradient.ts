import { colors } from "../theme/colors";
import { EventType } from "../lib/supabase";

export function getEventGradient(
  eventType?: EventType
): readonly [string, string, ...string[]] {
  switch (eventType) {
    case "birthday":
    case "party":
      return [...colors.posterGradient2];
    case "wedding":
      return [...colors.posterGradient1];
    case "graduation":
      return [...colors.primaryGradient];
    case "majlis":
    case "ramadan":
      return [...colors.posterGradient1];
    case "istiraha":
      return [...colors.posterGradient3];
    default:
      return [...colors.primaryGradient];
  }
}
