"use server";

import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { cookieSecure, getUser } from "@/lib/auth";
import { PREFS_COOKIE, defaultPrefs, sanitizePrefs, type Prefs } from "@/lib/prefs";

export async function savePrefs(input: Prefs): Promise<void> {
  const clean = sanitizePrefs(input, defaultPrefs());
  (await cookies()).set(PREFS_COOKIE, JSON.stringify(clean), {
    httpOnly: false,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  const u = await getUser();
  if (u) await sql.run("UPDATE users SET prefs = ? WHERE id = ?", JSON.stringify(clean), u.id);
}
