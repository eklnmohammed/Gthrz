import { colors } from "../theme/colors";

export type EventStatusPill = { label: string; color: string; bg: string };

export interface EventForStatus {
  hostPhone?: string;
  attendingStatus?: "going" | "pending" | "maybe" | "cant";
  visibility?: "public" | "private";
  declinedByHost?: boolean;
}

/**
 * Single source of truth for event status badge (Host / Going / Pending / etc.).
 * Use with EventCard statusPill so wording and styling are consistent everywhere.
 *
 * For public events, only "Going" is shown (no Maybe/Not going badges).
 */
export function getEventStatusPill(
  event: EventForStatus,
  userPhone: string
): EventStatusPill | undefined {
  if (!userPhone) return undefined;
  if (event.hostPhone === userPhone) {
    return { label: "Host", color: colors.primary, bg: colors.primaryLight20 };
  }
  const isPublic = event.visibility === "public";
  switch (event.attendingStatus) {
    case "going":
      return { label: "Going", color: colors.mint, bg: "rgba(78,205,196,0.15)" };
    case "pending":
      return { label: "Pending", color: colors.warning, bg: "rgba(255,165,2,0.15)" };
    case "maybe":
      // Public events don't show Maybe badge; treat as "Going" if any response
      return isPublic
        ? { label: "Going", color: colors.mint, bg: "rgba(78,205,196,0.15)" }
        : { label: "Maybe", color: colors.textMuted, bg: colors.surfaceLight };
    case "cant":
      if (event.declinedByHost) {
        // Declined by host — show for both public and private
        return { label: "Declined", color: colors.error, bg: "rgba(255,71,87,0.12)" };
      }
      // Public events don't show Not going badge; hide entirely
      return isPublic ? undefined : { label: "Not going", color: colors.error, bg: "rgba(255,71,87,0.12)" };
    default:
      return undefined;
  }
}
