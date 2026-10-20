import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { sql } from "./db";
import { getUser } from "./auth";
import { getSettings } from "./content";
import { PREFS_COOKIE, defaultPrefs, sanitizePrefs, type Prefs } from "./prefs";

/** Cookie first, then the signed-in user's saved prefs, then the site default theme. */
export const getPrefs = cache(async (): Promise<Prefs> => {
  const base = defaultPrefs((await getSettings()).default_theme);
  const raw = (await cookies()).get(PREFS_COOKIE)?.value;
  if (raw) {
    try {
      return sanitizePrefs(JSON.parse(raw), base);
    } catch {
      /* fall through */
    }
  }
  const u = await getUser();
  if (u) {
    const row = await sql.get<{ prefs: string }>("SELECT prefs FROM users WHERE id = ?", u.id);
    if (row) {
      try {
        return sanitizePrefs(JSON.parse(row.prefs), base);
      } catch {
        /* ignore */
      }
    }
  }
  return base;
});
