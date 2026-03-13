/**
 * Format event date/time for display across the app.
 * Returns format: "FEB 24 • 4:15 PM" (month abbrev, day, bullet, 12h time).
 */
export function formatEventDate(dateTime: string): string {
  try {
    const d = new Date(dateTime);
    if (isNaN(d.getTime())) return dateTime;
    const months = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC";
    const month = months.split(" ")[d.getMonth()];
    const day = d.getDate();
    const hours = d.getHours();
    const mins = d.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const h = hours % 12 || 12;
    const m = mins < 10 ? "0" + mins : mins;
    return `${month} ${day} • ${h}:${m} ${ampm}`;
  } catch {
    return dateTime;
  }
}
