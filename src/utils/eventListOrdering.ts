/** Minimal shape so this module does not import `eventsStore` (avoids circular deps). */
export type EventDateSortable = {
  dateTime: string;
  status?: string | null;
};

/**
 * Default ordering for event cards: upcoming soonest first (non-cancelled before cancelled),
 * past most recent first. When both are upcoming or both past, applies the same rule within the bucket.
 * When one is upcoming and one is past, upcoming comes first.
 */
export function compareEventsDefaultChronological(
  a: EventDateSortable,
  b: EventDateSortable,
  nowMs: number = Date.now(),
): number {
  const ta = new Date(a.dateTime).getTime();
  const tb = new Date(b.dateTime).getTime();
  const aFuture = ta >= nowMs;
  const bFuture = tb >= nowMs;
  if (aFuture !== bFuture) return aFuture ? -1 : 1;

  if (aFuture) {
    const aActive = a.status !== "cancelled";
    const bActive = b.status !== "cancelled";
    if (aActive !== bActive) return aActive ? -1 : 1;
    return ta - tb;
  }
  return tb - ta;
}
