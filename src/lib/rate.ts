import { sql } from "./db";

/**
 * Rate limiter stored in the database, so it holds when the app runs as many short-lived serverless
 * instances (an in-memory counter would reset on each one). The attempt is recorded first and then
 * counted, so a burst of parallel requests cannot all slip under the limit. Blocked attempts are recorded
 * too: hammering a locked account keeps it locked.
 * Returns true when this attempt is over `limit` within the last `windowMs`.
 */
export async function tooMany(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  await sql.run("INSERT INTO rate_limits (key, at) VALUES (?, ?)", key, now);
  const row = await sql.get<{ n: number }>("SELECT COUNT(*) AS n FROM rate_limits WHERE key = ? AND at > ?", key, now - windowMs);
  if (Math.random() < 0.02) await sql.run("DELETE FROM rate_limits WHERE at < ?", now - 24 * 60 * 60 * 1000);
  return (row?.n ?? 0) > limit;
}
