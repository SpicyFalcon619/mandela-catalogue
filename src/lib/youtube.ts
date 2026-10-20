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

/** The 11-character video id in a youtube.com/watch?v= or youtu.be/ link, or "" (for playlists and anything odd). */
export function youtubeId(value: unknown): string {
  const href = youtubeHref(value);
  if (!href) return "";
  const m = /[?&]v=([A-Za-z0-9_-]{11})(?:[&#]|$)/.exec(href) ?? /^https:\/\/youtu\.be\/([A-Za-z0-9_-]{11})(?:[?&#]|$)/i.exec(href);
  return m ? m[1] : "";
}
