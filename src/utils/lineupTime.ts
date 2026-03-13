/**
 * Lineup start/end times: stored as "HH:mm" (24h), displayed as 12h AM/PM.
 */

/** Parse "HH:mm" (24h) to a Date (today at that time). Handles invalid/empty. */
export function parseTime24ToDate(hhmm: string | undefined): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm.trim())) {
    d.setHours(20, 0, 0, 0);
    return d;
  }
  const [h, m] = hhmm.trim().split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    d.setHours(20, 0, 0, 0);
    return d;
  }
  d.setHours(Math.min(23, Math.max(0, h)), Math.min(59, Math.max(0, m)), 0, 0);
  return d;
}

/** Format a Date to "HH:mm" (24h). */
export function dateToTime24(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Format "HH:mm" to 12h display e.g. "10:00 PM". */
export function formatTime24ToDisplay(hhmm: string | undefined): string {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm.trim())) return "";
  const d = parseTime24ToDate(hhmm);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

/** Compare two "HH:mm" strings. Returns true if end > start (same day). */
export function isEndAfterStart(startTime: string | undefined, endTime: string | undefined): boolean {
  if (!startTime?.trim() || !endTime?.trim()) return true;
  const s = parseTime24ToDate(startTime).getTime();
  const e = parseTime24ToDate(endTime).getTime();
  return e > s;
}

/** Format lineup time range for display, e.g. "10:00 PM → 2:00 AM (next day)". Shows "(next day)" only when offset === 1. */
export function formatLineupTimeRange(
  startTime: string | undefined,
  endTime: string | undefined,
  endDayOffset: 0 | 1 = 0
): string {
  const start = formatTime24ToDisplay(startTime);
  const end = formatTime24ToDisplay(endTime);
  if (!start && !end) return "";
  if (!start) return end;
  if (!end) return start;
  const suffix = endDayOffset === 1 ? " (next day)" : "";
  return `${start} → ${end}${suffix}`;
}
