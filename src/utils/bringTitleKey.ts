/** Normalize for duplicate detection (trim, collapse spaces, lowercase). */
export function bringTitleKey(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}
