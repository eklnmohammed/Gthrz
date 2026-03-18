import { colors } from "../theme/colors";

export type EventStatusPill = { label: string; color: string; bg: string };

export interface EventForStatus {
  hostPhone?: string;
  attendingStatus?: "going" | "pending" | "maybe" | "cant";
}

/**
 * Single source of truth for event status badge (Host / Going / Pending / etc.).
 * Use with EventCard statusPill so wording and styling are consistent everywhere.
 */
export function getEventStatusPill(
  event: EventForStatus,
  userPhone: string
): EventStatusPill | undefined {
  if (!userPhone) return undefined;
  if (event.hostPhone === userPhone) {
    return { label: "Host", color: colors.primary, bg: colors.primaryLight20 };
  }
  switch (event.attendingStatus) {
    case "going":
      return { label: "Going", color: colors.mint, bg: "rgba(78,205,196,0.15)" };
    case "pending":
      return { label: "Pending", color: colors.warning, bg: "rgba(255,165,2,0.15)" };
    case "maybe":
      return { label: "Maybe", color: colors.textMuted, bg: colors.surfaceLight };
    case "cant":
      return { label: "Not going", color: colors.error, bg: "rgba(255,71,87,0.12)" };
    default:
      return undefined;
  }
}
