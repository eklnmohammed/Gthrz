/**
 * Format event date/time for display across the app.
 * Returns format: "FEB 24 • 4:15 PM" (month abbrev, day, bullet, 12h time).
 */
export function formatEventDate(dateTime: string): string {
  try {
    const d = new Date(dateTime);
    if (isNaN(d.getTime())) return dateTime;
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayOfWeek = dayNames[d.getDay()];
    const months = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC";
    const month = months.split(" ")[d.getMonth()];
    const dayOfMonth = d.getDate();
    const hours = d.getHours();
    const mins = d.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const h = hours % 12 || 12;
    const m = mins < 10 ? "0" + mins : mins;
    // Example: Thu · MAR 19 · 8:30 PM
    return `${dayOfWeek} · ${month} ${dayOfMonth} · ${h}:${m} ${ampm}`;
  } catch {
    return dateTime;
  }
}

/**
 * Shorter date/time format for event cards.
 * Example: "MAR 19 · 8:30 PM"
 */
export function formatEventDateForCards(dateTime: string): string {
  try {
    const d = new Date(dateTime);
    if (isNaN(d.getTime())) return dateTime;

    const months = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC";
    const month = months.split(" ")[d.getMonth()];
    const dayOfMonth = d.getDate();

    const hours = d.getHours();
    const mins = d.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const h = hours % 12 || 12;
    const m = mins < 10 ? "0" + mins : mins;

    return `${month} ${dayOfMonth} · ${h}:${m} ${ampm}`;
  } catch {
    return dateTime;
  }
}
