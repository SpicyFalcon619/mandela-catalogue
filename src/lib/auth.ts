import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sql } from "./db";

const COOKIE = "mc_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export type SessionUser = { id: number; username: string; role: "user" | "admin" };

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s === "change-me") {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set to a long random string in production.");
    return new TextEncoder().encode("dev-only-secret-do-not-use-in-production-0123456789");
  }
  return new TextEncoder().encode(s);
}

export function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";
}

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function startSession(userId: number) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: cookieSecure(), path: "/", maxAge: MAX_AGE });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in user (re-read from the database on every request, so bans and role changes apply at once). */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const id = Number(payload.sub);
    if (!Number.isInteger(id)) return null;
    const row = await sql.get<{ id: number; username: string; role: string; banned: number }>("SELECT id, username, role, banned FROM users WHERE id = ?", id);
    if (!row || row.banned) return null;
    return { id: row.id, username: row.username, role: row.role === "admin" ? "admin" : "user" };
  } catch {
    return null;
  }
});

export async function requireUser(next = "/"): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect("/login?next=/admin");
  if (u.role !== "admin") redirect("/");
  return u;
}

/** Only allow same-site relative paths after login. */
export function safeNext(n: unknown): string {
  return typeof n === "string" && /^\/(?!\/)[^\s]*$/.test(n) ? n : "/";
}
