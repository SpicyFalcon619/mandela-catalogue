import bcrypt from "bcryptjs";
import { startSession, endSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { jar, reqHeaders } from "./setup";

export function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
}

/** Runs an action and returns where it redirected, or null if it returned normally. */
export async function redirectOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (e) {
    const m = /^NEXT_REDIRECT:(.*)$/.exec((e as Error).message);
    if (m) return m[1];
    throw e;
  }
}

let counter = 0;

/** Inserts a user directly (cheap bcrypt cost) and returns its id. */
export async function makeUser(role: "user" | "admin" = "user", password = "correct-horse-battery"): Promise<{ id: number; username: string; password: string }> {
  const username = `${role}_${++counter}`;
  const res = await sql.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", username, bcrypt.hashSync(password, 4), role);
  return { id: res.lastId, username, password };
}

export async function signInAs(userId: number) {
  await startSession(userId);
}

export async function signOut() {
  await endSession();
}

/** Clears the fake browser between tests. */
export function resetRequest() {
  jar.clear();
  reqHeaders.clear();
}

export const count = async (q: string, ...args: (string | number | null)[]) => (await sql.get<{ n: number }>(q, ...args))!.n;
