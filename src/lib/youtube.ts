/**
 * Only https links on youtube.com or youtu.be are ever rendered as "Watch" links. Admin input is checked on
 * save and again when read, so a bad value in the database (for example a javascript: URL) can never become an href.
 * Returns the trimmed URL, or "" if it is not acceptable.
 */
export function youtubeHref(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (!/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\/[^\s"'<>]+$/i.test(v)) return "";
  return v;
}
