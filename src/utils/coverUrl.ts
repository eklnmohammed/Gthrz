/**
 * Only treat coverUrl as valid for display if it is an HTTP(S) URL.
 * Ignore file:// paths and empty values so we fall back to coverKey.
 */
export function isValidCoverUrl(url: string | null | undefined): boolean {
  if (url == null || typeof url !== "string" || url.trim() === "") return false;
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}
